@echo off
REM Скрипт для запуска автоматических сигналов на Windows
REM Запускайте этот файл через Task Scheduler каждые 5 минут
REM DEPRECATED: делегирует выполнение в crypto-analyzer/start_auto_signals.bat

cd /d "%~dp0"
set "TARGET_DIR=%~dp0crypto-analyzer"
if exist "%TARGET_DIR%\start_auto_signals.bat" (
    echo Делегирую запуск в crypto-analyzer/start_auto_signals.bat
    cd /d "%TARGET_DIR%"
    call start_auto_signals.bat %*
) else (
    echo ОШИБКА: crypto-analyzer/start_auto_signals.bat не найден
    exit /b 1
)



