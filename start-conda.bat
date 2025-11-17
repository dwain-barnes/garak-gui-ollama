@echo off
echo Starting Garak GUI...
echo.

REM Check if conda is available
where conda >nul 2>&1
if errorlevel 1 (
    echo ERROR: Conda not found. Please ensure Anaconda/Miniconda is installed
    echo and added to PATH, or run this from Anaconda Prompt.
    pause
    exit /b 1
)

REM Check if garak environment exists
conda env list | findstr /C:"garak" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Conda environment 'garak' not found.
    echo Please create it first with: conda create -n garak python=3.10
    pause
    exit /b 1
)

echo [OK] Conda environment 'garak' found

REM Check if Ollama is running
echo Checking Ollama connection...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama is not running. Please start Ollama first.
    echo Run: ollama serve
    pause
    exit /b 1
)
echo [OK] Ollama is running

REM Check if requirements are installed
echo Checking dependencies...
call conda activate garak
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    cd backend
    pip install -r requirements.txt
    cd ..
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

echo.
echo Starting backend server...
cd backend
start "Garak Backend" cmd /k "conda activate garak && python main.py"
cd ..

timeout /t 3 >nul

echo Starting frontend server...
cd frontend
start "Garak Frontend" cmd /k "conda activate garak && python -m http.server 8080"
cd ..

timeout /t 2 >nul

echo.
echo ======================================
echo   Garak GUI is ready!
echo ======================================
echo.
echo Access the application at:
echo   http://localhost:8080
echo.
echo API documentation at:
echo   http://localhost:8000/docs
echo.
echo Conda environment: garak
echo ======================================
echo.
echo Close the terminal windows to stop
echo ======================================
echo.
pause
