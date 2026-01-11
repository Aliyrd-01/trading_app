#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для автоматической миграции базы данных.
Добавляет новые колонки для настроек уведомлений в таблицу users.
"""

from app import app, db
from sqlalchemy import inspect, text

def run_migration():
    """Добавляет новые колонки в таблицу users, если их нет."""
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            print("Проверка существующих колонок...")
            print(f"Найдено колонок: {len(columns)}")
            
            migrations = []
            
            if 'telegram_chat_id' not in columns:
                migrations.append(("telegram_chat_id", "ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(50) NULL AFTER plan"))
            
            if 'enable_telegram_notifications' not in columns:
                migrations.append(("enable_telegram_notifications", "ALTER TABLE users ADD COLUMN enable_telegram_notifications BOOLEAN DEFAULT FALSE AFTER telegram_chat_id"))
            
            if 'enable_email_notifications' not in columns:
                migrations.append(("enable_email_notifications", "ALTER TABLE users ADD COLUMN enable_email_notifications BOOLEAN DEFAULT FALSE AFTER enable_telegram_notifications"))
            
            if 'alert_min_reliability' not in columns:
                migrations.append(("alert_min_reliability", "ALTER TABLE users ADD COLUMN alert_min_reliability FLOAT DEFAULT 60.0 AFTER enable_email_notifications"))
            
            if not migrations:
                print("✅ Все колонки уже существуют. Миграция не требуется.")
                return
            
            print(f"\nНайдено {len(migrations)} колонок для добавления:")
            for col_name, _ in migrations:
                print(f"  - {col_name}")
            
            print("\nВыполнение миграции...")
            for col_name, sql in migrations:
                try:
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"✅ Добавлена колонка: {col_name}")
                except Exception as e:
                    db.session.rollback()
                    print(f"⚠️ Ошибка при добавлении {col_name}: {e}")
                    # Пробуем добавить без указания позиции
                    try:
                        if 'telegram_chat_id' in col_name:
                            db.session.execute(text("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(50) NULL"))
                        elif 'enable_telegram_notifications' in col_name:
                            db.session.execute(text("ALTER TABLE users ADD COLUMN enable_telegram_notifications BOOLEAN DEFAULT FALSE"))
                        elif 'enable_email_notifications' in col_name:
                            db.session.execute(text("ALTER TABLE users ADD COLUMN enable_email_notifications BOOLEAN DEFAULT FALSE"))
                        elif 'alert_min_reliability' in col_name:
                            db.session.execute(text("ALTER TABLE users ADD COLUMN alert_min_reliability FLOAT DEFAULT 60.0"))
                        db.session.commit()
                        print(f"✅ Добавлена колонка: {col_name} (без указания позиции)")
                    except Exception as e2:
                        print(f"❌ Не удалось добавить {col_name}: {e2}")
            
            print("\n✅ Миграция завершена!")
            
        except Exception as e:
            print(f"❌ Ошибка миграции: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_migration()

























