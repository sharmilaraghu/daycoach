#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Cleanup on exit
trap 'echo ""; echo "Stopping servers..."; kill $API_PID $FE_PID 2>/dev/null; exit' INT TERM

echo "Starting API server..."
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting frontend..."
pnpm --filter @workspace/daycoach run dev &
FE_PID=$!

echo ""
echo "API:      http://localhost:8080"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

wait $API_PID $FE_PID
