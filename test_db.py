import sys
from app import app, db
from sqlalchemy import text

try:
    # Устанавливаем кодировку вывода в консоль
    if sys.stdout.encoding != 'utf-8':
        import io
        import sys
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("Проверка подключения к базе данных...")
    
    # Проверяем подключение к БД
    with app.app_context():
        # Пытаемся выполнить простой запрос к базе данных
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("[УСПЕХ] Подключение к базе данных успешно установлено!")
            print(f"Результат тестового запроса: {result.scalar()}")
            
            # Пробуем получить список таблиц
            result = conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result.fetchall()]
            print(f"\nНайдено таблиц в базе данных: {len(tables)}")
            if tables:
                print("Первые 10 таблиц:", ", ".join(tables[:10]))
            
except Exception as e:
    import traceback
    print(f"[ОШИБКА] Не удалось подключиться к базе данных:")
    print(f"Тип ошибки: {type(e).__name__}")
    print(f"Сообщение: {str(e)}")
    print("\nТрассировка:")
    traceback.print_exc()
