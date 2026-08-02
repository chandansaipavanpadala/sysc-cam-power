@echo off
echo ========================================================
echo   Launching SystemC CAM Power Visualizer Web App...
echo ========================================================

:: Compile latest SystemC executable and generate simulation dataset
g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe
if %ERRORLEVEL% EQU 0 (
    echo Compilation successful! Running SystemC backend simulation...
    sim.exe --no-pause
    echo.
    echo Launching Web Server on http://localhost:3000 ...
    start http://localhost:3000
    node server.js
) else (
    echo.
    echo Compilation Failed! Please check SystemC installation.
    pause
)
