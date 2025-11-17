@echo off
echo ========================================
echo   Garak GUI - Setup (venv)
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10 or higher.
    pause
    exit /b 1
)

echo [OK] Python found

REM Check if venv exists
if exist venv\ (
    echo [OK] Virtual environment already exists
) else (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
)

REM Activate virtual environment
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo Installing dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Installing Garak from GitHub (latest version)...
python -m pip install -U git+https://github.com/NVIDIA/garak.git@main
if errorlevel 1 (
    echo ERROR: Failed to install Garak from GitHub
    pause
    exit /b 1
)
cd ..

echo [OK] Dependencies installed

REM Check Ollama
echo.
echo Checking Ollama connection...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama is not running.
    echo Please start Ollama with: ollama serve
    echo Then pull a model with: ollama pull llama3.2
) else (
    echo [OK] Ollama is running
)

REM Create data directory
echo.
echo Creating data directory...
if not exist "backend\data\" mkdir backend\data
echo [] > backend\data\scans.json
echo [OK] Data directory ready

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start Garak GUI:
echo   start.bat
echo.
echo Don't forget to:
echo   1. Start Ollama: ollama serve
echo   2. Pull a model: ollama pull llama3.2
echo.
pause
