#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для добавления колонки exchange_spread в таблицу users
"""
import sys
import os
from sqlalchemy import create_engine, text

# Устанавливаем кодировку для вывода в Windows
if sys.platform == 'win32':
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except:
        pass

# Используем те же настройки подключения, что и в app.py
DATABASE_URI = "mysql+pymysql://u543957720_crypto:AgUbbkD1h!@auth-db936.hstgr.io/u543957720_cryptoprice"

def add_exchange_spread_column():
    """Добавляет колонку exchange_spread в таблицу users"""
    try:
        print("🔌 Подключение к базе данных...")
        engine = create_engine(DATABASE_URI)
        
        with engine.connect() as conn:
            # Проверяем, существует ли колонка
            print("🔍 Проверка наличия колонки exchange_spread...")
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = 'u543957720_cryptoprice' 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME = 'exchange_spread'
            """))
            count = result.fetchone()[0]
            
            if count > 0:
                print("✅ Колонка exchange_spread уже существует в таблице users")
                return True
            
            # Добавляем колонку
            print("➕ Добавление колонки exchange_spread...")
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN exchange_spread FLOAT DEFAULT 0.0 
                COMMENT 'Спред биржи в процентах (например, 0.1 = 0.1%)'
            """))
            conn.commit()
            print("✅ Колонка exchange_spread успешно добавлена в таблицу users")
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при добавлении колонки: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Добавление колонки exchange_spread в таблицу users")
    print("=" * 60)
    
    success = add_exchange_spread_column()
    
    if success:
        print("\n✅ Готово! Колонка добавлена или уже существует.")
        sys.exit(0)
    else:
        print("\n❌ Не удалось добавить колонку. Проверьте ошибки выше.")
        sys.exit(1)

