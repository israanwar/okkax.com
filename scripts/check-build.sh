#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
export CI=true
export REACT_APP_BACKEND_URL="${REACT_APP_BACKEND_URL:-http://127.0.0.1:8001}"

(cd "$ROOT_DIR/frontend" && yarn build)
