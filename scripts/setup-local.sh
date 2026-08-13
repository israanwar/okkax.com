#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BREW_BIN="${BREW_BIN:-/opt/homebrew/bin/brew}"
PYTHON_BIN="${PYTHON_BIN:-/opt/homebrew/bin/python3.12}"

if [[ ! -x "$BREW_BIN" ]]; then
  echo "Homebrew tidak ditemukan di $BREW_BIN. Ikuti README untuk instalasi resmi."
  exit 1
fi

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

for command in mongosh yarn; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command belum tersedia. Ikuti bagian Prasyarat pada README."
    exit 1
  fi
done

if ! mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
  brew services start mongodb/brew/mongodb-community@8.0 >/dev/null
fi
mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)'

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python 3.12 tidak ditemukan di $PYTHON_BIN."
  exit 1
fi

if [[ ! -d "$ROOT_DIR/backend/.venv" ]]; then
  "$PYTHON_BIN" -m venv "$ROOT_DIR/backend/.venv"
fi
"$ROOT_DIR/backend/.venv/bin/python" -m pip install --upgrade pip
"$ROOT_DIR/backend/.venv/bin/pip" install -r "$ROOT_DIR/backend/requirements-local.txt"

if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  "$PYTHON_BIN" - "$ROOT_DIR/backend/.env" <<'PY'
import secrets
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
text = text.replace("replace-with-a-long-random-local-value", secrets.token_urlsafe(48))
text = text.replace("replace-with-a-local-demo-password", secrets.token_urlsafe(18))
text = text.replace("replace-with-a-local-admin-password", secrets.token_urlsafe(18))
path.write_text(text)
PY
  chmod 600 "$ROOT_DIR/backend/.env"
fi

if [[ ! -f "$ROOT_DIR/frontend/.env" ]]; then
  cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"
fi

(cd "$ROOT_DIR/frontend" && yarn install --frozen-lockfile)
echo "Setup lokal selesai. Database: okkax_local"
