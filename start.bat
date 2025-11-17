@echo off
echo Starting Garak GUI...
echo.

REM Check if venv exists
if not exist venv\ (
    echo ERROR: Virtual environment not found.
    echo Please run setup.bat first.
    pause
    exit /b 1
)

echo [OK] Virtual environment found

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

echo.
echo Starting backend server...
cd backend
start "Garak Backend" cmd /k "..\venv\Scripts\activate.bat && python main.py"
cd ..

timeout /t 3 >nul

echo Starting frontend server...
cd frontend
start "Garak Frontend" cmd /k "..\venv\Scripts\activate.bat && python -m http.server 8080"
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
echo ======================================
echo.
echo Close the terminal windows to stop
echo ======================================
echo.
pause
