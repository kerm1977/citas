@echo off
echo Deteniendo Chat-App...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Chat-App detenido correctamente.
) else (
    echo No se encontraron procesos de node ejecutandose.
)
echo.
pause
