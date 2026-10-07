@echo off
REM QuickPic Hardware Daemon Installation Script for Windows
REM This script installs gphoto2, Python dependencies, and sets up the daemon as a service

echo.
echo ============================================
echo QuickPic Hardware Daemon - Windows Setup
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org
    pause
    exit /b 1
)

echo [1/5] Python found:
python --version
echo.

REM Check if gphoto2 is installed
where gphoto2 >nul 2>&1
if errorlevel 1 (
    echo [2/5] gphoto2 not found. Installing...
    echo Please download and install gphoto2 from:
    echo https://sourceforge.net/projects/gphoto/files/gphoto2/
    echo.
    echo After installing gphoto2, run this script again.
    pause
    exit /b 1
) else (
    echo [2/5] gphoto2 found:
    gphoto2 --version | head -1
    echo.
)

REM Install Python dependencies
echo [3/5] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)
echo.

REM Create a service wrapper script
echo [4/5] Creating startup script...
(
    echo @echo off
    echo cd /d "%CD%"
    echo python app.py
) > start-daemon.bat
echo Created start-daemon.bat
echo.

REM Instructions
echo [5/5] Setup Complete!
echo.
echo ============================================
echo Next Steps:
echo ============================================
echo.
echo 1. Connect your Canon camera via USB-C
echo 2. Connect your DNP printer via USB
echo 3. Run the daemon:
echo    cd hardware-daemon
echo    python app.py
echo.
echo 4. Test the connection:
echo    gphoto2 --auto-detect
echo    lpstat -p
echo.
echo 5. Access the API at: http://localhost:8000
echo 6. Diagnostics at: http://localhost:8000/debug/usb
echo.
pause
