#!/bin/bash
# Добавляет задачу в cron для проверки автоматических сигналов каждые 5 минут

# Получаем путь к Python и скрипту
PYTHON_PATH=$(which python3)
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/auto_signals_worker.py"

# Добавляем в crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $(dirname "$SCRIPT_PATH") && $PYTHON_PATH $SCRIPT_PATH >> $(dirname "$SCRIPT_PATH")/auto_signals.log 2>&1") | crontab -

echo "✅ Cron задача добавлена. Проверка будет выполняться каждые 5 минут."
echo "Для просмотра логов: tail -f auto_signals.log"



