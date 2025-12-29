#!/bin/sh
set -e

echo "Starting SMServer..."

# Start backend in background
echo "Starting backend on port 8080..."
cd /app/backend
./smserver &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
    if wget --spider -q http://localhost:8080/api/health 2>/dev/null; then
        echo "Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Backend failed to start"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend on port 3000..."
cd /app/frontend
node server.js &
FRONTEND_PID=$!

# Function to handle shutdown
shutdown() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Trap signals
trap shutdown SIGTERM SIGINT

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
