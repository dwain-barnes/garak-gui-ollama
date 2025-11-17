#!/bin/bash

echo "========================================"
echo "  Garak GUI - Conda Setup"
echo "========================================"
echo ""

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "ERROR: Conda not found. Please install Anaconda/Miniconda first."
    echo "Or initialize conda with: conda init bash"
    exit 1
fi

echo "[OK] Conda found"

# Check if garak environment exists
if conda env list | grep -q "^garak "; then
    echo "[OK] Conda environment 'garak' already exists"
else
    echo ""
    echo "Conda environment 'garak' not found."
    read -p "Create environment with Python 3.10? (y/n): " CREATE
    if [[ "$CREATE" =~ ^[Yy]$ ]]; then
        echo "Creating conda environment 'garak'..."
        conda create -n garak python=3.10 -y
        if [ $? -ne 0 ]; then
            echo "ERROR: Failed to create conda environment"
            exit 1
        fi
        echo "[OK] Environment created"
    else
        echo "Please create the environment manually with:"
        echo "  conda create -n garak python=3.10"
        exit 1
    fi
fi

# Activate environment and install dependencies
echo ""
echo "Installing dependencies in 'garak' environment..."
eval "$(conda shell.bash hook)"
conda activate garak

cd backend
echo "Installing Python packages..."
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
echo "Conda environment: garak"
echo ""
echo "To start Garak GUI:"
echo "  ./start-conda.sh"
echo ""
echo "Don't forget to:"
echo "  1. Start Ollama: ollama serve"
echo "  2. Pull a model: ollama pull llama3.2"
echo ""
