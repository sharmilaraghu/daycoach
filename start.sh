#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load .env from project root if it exists
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Cleanup on exit
trap 'echo ""; echo "Stopping servers..."; kill $API_PID $FE_PID 2>/dev/null; exit' INT TERM

echo "Starting API server..."
PORT=8080 pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting frontend..."
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/daycoach run dev &
FE_PID=$!

echo ""
echo "API:      http://localhost:8080"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

wait $API_PID $FE_PID
