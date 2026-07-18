#!/usr/bin/env bash
# One-command local launch for together, apart.
# Starts the FastAPI backend on :8000 and the React dev server on :3000,
# then opens the app in your browser. Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Backend ---------------------------------------------------------------
cd "$ROOT/backend"

if [ ! -x .venv/bin/python ]; then
  echo "==> Creating backend virtualenv (backend/.venv)"
  # The pinned deps need Python 3.10+; prefer the newest available.
  PY="$(command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3)"
  "$PY" -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

echo "==> Backend:  http://localhost:8000"
.venv/bin/uvicorn server:app --reload --port 8000 &
BACKEND_PID=$!

# --- Frontend --------------------------------------------------------------
cd "$ROOT/frontend"

if [ ! -d node_modules ]; then
  echo "==> Installing frontend dependencies (first run only, takes a few minutes)"
  if command -v yarn >/dev/null 2>&1; then
    yarn install
  else
    npm install --legacy-peer-deps
    # npm hoists ajv@6 for react-scripts; schema-utils needs v8 at the top level.
    npm install ajv@^8 --no-save --legacy-peer-deps
  fi
fi

echo "==> Frontend: http://localhost:3000"
REACT_APP_BACKEND_URL=http://localhost:8000 npm start &
FRONTEND_PID=$!

# --- Cleanup on exit --------------------------------------------------------
trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true' EXIT INT TERM
wait
