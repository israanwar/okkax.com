#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

[[ -f "$ROOT_DIR/backend/.env" ]] || { echo "Jalankan ./scripts/setup-local.sh dahulu."; exit 1; }
[[ -f "$ROOT_DIR/frontend/.env" ]] || { echo "Jalankan ./scripts/setup-local.sh dahulu."; exit 1; }

if ! mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
  brew services start mongodb/brew/mongodb-community@8.0 >/dev/null
fi

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$ROOT_DIR/backend" && .venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --reload) &
BACKEND_PID=$!
(cd "$ROOT_DIR/frontend" && yarn start) &
FRONTEND_PID=$!

echo "Frontend: http://localhost:3000"
echo "Backend:  http://127.0.0.1:8001"
wait "$BACKEND_PID" "$FRONTEND_PID"
