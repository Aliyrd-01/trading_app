#!/bin/bash
# Добавляет задачу в cron для проверки автоматических сигналов каждые 5 минут
# DEPRECATED: делегирует выполнение в crypto-analyzer/setup_cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/crypto-analyzer"
TARGET_SCRIPT="$TARGET_DIR/setup_cron.sh"

if [ -f "$TARGET_SCRIPT" ]; then
    echo "Делегирую выполнение в crypto-analyzer/setup_cron.sh"
    cd "$TARGET_DIR"
    exec bash setup_cron.sh "$@"
else
    echo "ОШИБКА: crypto-analyzer/setup_cron.sh не найден" >&2
    exit 1
fi



