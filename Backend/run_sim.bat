@echo off
echo ========================================================
echo   Compiling SystemC CAM Power Model Assignment...
echo ========================================================
g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Compilation successful! Running SystemC Simulation...
    echo.
    sim.exe
) else (
    echo.
    echo Compilation Failed! Please check SystemC library installation.
    echo.
    pause
)
