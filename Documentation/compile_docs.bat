@echo off
echo ========================================================
echo   Compiling SystemC CAM Technical Manual (LaTeX)...
echo ========================================================

cd /d "%~dp0"

echo [1/3] Running First Pass (pdflatex)...
pdflatex -interaction=nonstopmode -synctex=1 manual.tex

echo [2/3] Running Second Pass (pdflatex)...
pdflatex -interaction=nonstopmode -synctex=1 manual.tex

echo [3/3] Running Final Pass (pdflatex)...
pdflatex -interaction=nonstopmode -synctex=1 manual.tex

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   Compilation Successful! Generated Documentation/manual.pdf
    echo ========================================================
) else (
    echo.
    echo Compilation encountered warnings/errors. Please inspect manual.log.
)
