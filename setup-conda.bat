@echo off
echo ========================================
echo   Garak GUI - Conda Setup
echo ========================================
echo.

REM Check if conda is available
where conda >nul 2>&1
if errorlevel 1 (
    echo ERROR: Conda not found. Please ensure Anaconda/Miniconda is installed
    echo and added to PATH, or run this from Anaconda Prompt.
    pause
    exit /b 1
)

echo [OK] Conda found

REM Check if garak environment exists
conda env list | findstr /C:"garak" >nul 2>&1
if errorlevel 1 (
    echo.
    echo Conda environment 'garak' not found.
    echo Would you like to create it now? (This will install Python 3.10)
    set /p CREATE="Create environment? (Y/N): "
    if /i "%CREATE%"=="Y" (
        echo Creating conda environment 'garak'...
        conda create -n garak python=3.10 -y
        if errorlevel 1 (
            echo ERROR: Failed to create conda environment
            pause
            exit /b 1
        )
        echo [OK] Environment created
    ) else (
        echo Please create the environment manually with:
        echo   conda create -n garak python=3.10
        pause
        exit /b 1
    )
) else (
    echo [OK] Conda environment 'garak' already exists
)

REM Activate environment and install dependencies
echo.
echo Installing dependencies in 'garak' environment...
call conda activate garak

cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
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
echo Conda environment: garak
echo.
echo To start Garak GUI:
echo   start-conda.bat
echo.
echo Don't forget to:
echo   1. Start Ollama: ollama serve
echo   2. Pull a model: ollama pull llama3.2
echo.
pause
