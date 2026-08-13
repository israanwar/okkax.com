#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' || true)"
if [[ -n "$tracked_env" ]]; then
  echo "File environment rahasia ikut ter-track:"
  echo "$tracked_env"
  exit 1
fi

if git grep -IEn '(mongodb(\+srv)?://[^[:space:]]+:[^[:space:]]+@|sk_(live|test)_[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' -- ':!*.example' ':!scripts/check-secrets.sh'; then
  echo "Pola secret atau private key terdeteksi pada file ter-track."
  exit 1
fi

echo "Pemeriksaan file environment dan pola secret lulus."
