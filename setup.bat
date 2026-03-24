@echo off
REM ─────────────────────────────────────────────────────────────
REM NPTEL Smart Prep AI — One-command setup script (Windows)
REM Usage: Double-click setup.bat or run in Command Prompt
REM ─────────────────────────────────────────────────────────────

echo.
echo ╔══════════════════════════════════════════╗
echo ║     NPTEL Smart Prep AI - Setup          ║
echo ╚══════════════════════════════════════════╝
echo.

REM Check Node.js
node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js found

REM Check Python
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Python not found. Please install from https://python.org
    pause & exit /b 1
)
echo [OK] Python found

REM ── Backend Setup ─────────────────────────────────────
echo.
echo Setting up Backend...
cd backend

IF NOT EXIST .env (
    copy .env.example .env
    echo [NOTE] Created backend\.env - Please add your API keys!
)

IF NOT EXIST venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

echo Installing Python dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip -q
pip install -r requirements.txt -q
call venv\Scripts\deactivate.bat
cd ..
echo [OK] Backend dependencies installed

REM ── Frontend Setup ────────────────────────────────────
echo.
echo Setting up Frontend...
cd frontend
echo Installing Node dependencies (this may take 1-2 minutes)...
npm install --silent
cd ..
echo [OK] Frontend dependencies installed

REM ── Done ──────────────────────────────────────────────
echo.
echo ╔══════════════════════════════════════════╗
echo ║     Setup Complete!                      ║
echo ╚══════════════════════════════════════════╝
echo.
echo Next steps:
echo.
echo   1. Add your API keys to backend\.env
echo      Set GEMINI_API_KEY=your_key_here
echo      Set OPENAI_API_KEY=your_key_here
echo.
echo   2. Start backend (Command Prompt 1):
echo      cd backend ^&^& venv\Scripts\activate ^&^& python app.py
echo.
echo   3. Start frontend (Command Prompt 2):
echo      cd frontend ^&^& npm start
echo.
echo   4. Open browser: http://localhost:3000
echo.
echo Happy studying!
echo.
pause
