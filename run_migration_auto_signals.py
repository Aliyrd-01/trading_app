"""
Скрипт для выполнения миграции БД для автоматических сигналов.
Запустите: python run_migration_auto_signals.py
"""
import sys
import os

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import inspect, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    """Добавляет колонки для автоматических сигналов, если их нет."""
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            columns_info = {col['name']: col for col in inspector.get_columns('users')}
            
            migrations = [
                ('auto_signals_enabled', 'BOOLEAN DEFAULT FALSE'),
                ('auto_signal_symbol', 'VARCHAR(20) NULL'),
                ('auto_signal_capital', 'FLOAT NULL'),
                ('auto_signal_trading_type', 'VARCHAR(50) NULL'),
                ('auto_signal_strategy', 'VARCHAR(50) NULL'),
                ('auto_signal_risk', 'FLOAT NULL'),
                ('auto_signal_confirmation', 'VARCHAR(255) NULL'),
                ('auto_signal_min_reliability', 'FLOAT DEFAULT 60.0'),
                ('auto_signal_check_interval', 'INT DEFAULT 60'),
                ('auto_signal_last_check', 'DATETIME NULL'),
                ('auto_signal_last_signal_price', 'FLOAT NULL'),
                ('auto_signal_last_signal_direction', 'VARCHAR(10) NULL'),
            ]
            
            for col_name, col_def in migrations:
                if col_name not in columns:
                    logger.info(f"Добавление колонки {col_name}...")
                    db.session.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
                    logger.info(f"✅ Колонка {col_name} добавлена")
                else:
                    logger.info(f"ℹ️ Колонка {col_name} уже существует")

            # Расширяем длину auto_signal_confirmation, если колонка уже была создана ранее с меньшей длиной
            info = columns_info.get('auto_signal_confirmation')
            if info and info.get('type') is not None and hasattr(info['type'], 'length'):
                try:
                    current_len = int(getattr(info['type'], 'length') or 0)
                except Exception:
                    current_len = 0
                if current_len and current_len < 255:
                    logger.info(f"Обновление длины auto_signal_confirmation: {current_len} -> 255")
                    db.session.execute(text("ALTER TABLE users MODIFY COLUMN auto_signal_confirmation VARCHAR(255) NULL"))
                    logger.info("✅ Колонка auto_signal_confirmation обновлена")
            
            db.session.commit()
            logger.info("✅ Миграция завершена успешно!")
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Ошибка миграции: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise

if __name__ == "__main__":
    logger.info("🚀 Запуск миграции для автоматических сигналов...")
    run_migration()



