#!/bin/bash

echo "Starting Garak GUI..."
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "ERROR: Virtual environment not found."
    echo "Please run ./setup.sh first."
    exit 1
fi

echo "[OK] Virtual environment found"

# Check if Ollama is running
echo "Checking Ollama connection..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "ERROR: Ollama is not running. Please start Ollama first."
    echo "Run: ollama serve"
    exit 1
fi
echo "[OK] Ollama is running"

# Activate virtual environment
source venv/bin/activate

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down Garak GUI..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "Starting backend server..."
cd backend
python main.py &
BACKEND_PID=$!
cd ..

sleep 3

echo "Starting frontend server..."
cd frontend
python -m http.server 8080 &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo "======================================"
echo "  Garak GUI is ready!"
echo "======================================"
echo ""
echo "Access the application at:"
echo "  http://localhost:8080"
echo ""
echo "API documentation at:"
echo "  http://localhost:8000/docs"
echo ""
echo "======================================"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"
echo ""

# Wait for user interrupt
wait
