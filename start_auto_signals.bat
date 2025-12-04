@echo off
REM Скрипт для запуска автоматических сигналов на Windows
REM Запускайте этот файл через Task Scheduler каждые 5 минут

cd /d "%~dp0"
python auto_signals_worker.py >> auto_signals.log 2>&1



