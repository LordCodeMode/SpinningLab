#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

exec uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload \
  --reload-dir app \
  --reload-dir shared \
  --reload-exclude "venv/*" \
  --reload-exclude ".venv/*" \
  --reload-exclude "__pycache__/*"
