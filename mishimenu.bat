@echo off
setlocal
set "DIR=%~dp0"

where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Python is not installed or not on PATH.
    echo  Download it from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

python "%DIR%mishimenu.py" %*
