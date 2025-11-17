#!/bin/bash

echo "========================================"
echo "  Garak GUI - Setup (venv)"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found. Please install Python 3.10 or higher."
    exit 1
fi

echo "[OK] Python found"

# Check if venv exists
if [ -d "venv" ]; then
    echo "[OK] Virtual environment already exists"
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        exit 1
    fi
    echo "[OK] Virtual environment created"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo ""
echo "Installing dependencies..."
cd backend
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "Installing Garak from GitHub (latest version)..."
python -m pip install -U git+https://github.com/NVIDIA/garak.git@main
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Garak from GitHub"
    exit 1
fi
cd ..

echo "[OK] Dependencies installed"

# Check Ollama
echo ""
echo "Checking Ollama connection..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[OK] Ollama is running"
else
    echo "WARNING: Ollama is not running."
    echo "Please start Ollama with: ollama serve"
    echo "Then pull a model with: ollama pull llama3.2"
fi

# Create data directory
echo ""
echo "Creating data directory..."
mkdir -p backend/data
echo "[]" > backend/data/scans.json
echo "[OK] Data directory ready"

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "To start Garak GUI:"
echo "  ./start.sh"
echo ""
echo "Don't forget to:"
echo "  1. Start Ollama: ollama serve"
echo "  2. Pull a model: ollama pull llama3.2"
echo ""
