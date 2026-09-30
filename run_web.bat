@echo off
title SystemC CAM Power Visualizer - Server & Telemetry Logs
echo ========================================================
echo   SystemC CAM Power Visualizer - ESL Workbench
echo ========================================================
echo.

cd /d "%~dp0Backend"

echo [1/3] Verifying and Compiling SystemC C++ Backend...
g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe

if %ERRORLEVEL% EQU 0 (
    echo [2/3] Compilation Successful! Running SystemC simulation...
    sim.exe --no-pause
    echo.
    echo [3/3] Starting Web Server on http://localhost:3000 ...
    cd /d "%~dp0"
    start http://localhost:3000
    echo The terminal will remain open to stream live simulation and HTTP request logs.
    echo.
    node Frontend/server.js
) else (
    echo.
    echo [ERROR] Compilation Failed! Please check your MinGW g++ and SystemC setup.
)

echo.
echo ========================================================
echo   Server stopped. Press any key to exit this window...
echo ========================================================
pause
