#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

[[ -f "$ROOT_DIR/backend/.env" ]] || { echo "Jalankan ./scripts/setup-local.sh dahulu."; exit 1; }

set -a
source "$ROOT_DIR/backend/.env"
set +a

if [[ "$DB_NAME" != "okkax_local" ]]; then
  echo "Test lokal ditolak: DB_NAME harus okkax_local, saat ini '$DB_NAME'."
  exit 1
fi
if [[ "$MONGO_URL" != "mongodb://127.0.0.1:27017" && "$MONGO_URL" != "mongodb://localhost:27017" ]]; then
  echo "Test lokal ditolak: MONGO_URL harus menunjuk MongoDB lokal."
  exit 1
fi

export REACT_APP_BACKEND_URL="http://127.0.0.1:8001"
export TEST_BASE_URL="$REACT_APP_BACKEND_URL"
export PYTHONPATH="$ROOT_DIR/backend"

if ! mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
  brew services start mongodb/brew/mongodb-community@8.0 >/dev/null
fi
mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)'

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$ROOT_DIR/backend" && .venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001) &
BACKEND_PID=$!

for _ in {1..60}; do
  if curl -fsS "$REACT_APP_BACKEND_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "$REACT_APP_BACKEND_URL/api/health" >/dev/null

(cd "$ROOT_DIR/backend" && .venv/bin/pytest -n 0)
