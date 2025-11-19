# Инструкция по миграции базы данных

## Проблема
В таблице `users` отсутствуют новые колонки для настроек уведомлений:
- `telegram_chat_id`
- `enable_telegram_notifications`
- `enable_email_notifications`
- `alert_min_reliability`

## Решение

### Вариант 1: Выполнить SQL скрипт вручную (рекомендуется)

1. Откройте файл `migration_add_notification_fields.sql`
2. Выполните SQL команды в вашей базе данных через phpMyAdmin, MySQL Workbench или командную строку:

```sql
ALTER TABLE `users` 
ADD COLUMN `telegram_chat_id` VARCHAR(50) NULL AFTER `plan`,
ADD COLUMN `enable_telegram_notifications` BOOLEAN DEFAULT FALSE AFTER `telegram_chat_id`,
ADD COLUMN `enable_email_notifications` BOOLEAN DEFAULT FALSE AFTER `enable_telegram_notifications`,
ADD COLUMN `alert_min_reliability` FLOAT DEFAULT 60.0 AFTER `enable_email_notifications`;
```

### Вариант 2: Через командную строку MySQL

```bash
mysql -u ваш_пользователь -p ваша_база_данных < migration_add_notification_fields.sql
```

### Вариант 3: Через Python (автоматически)

Запустите скрипт для автоматического добавления колонок:

```python
from app import app, db
from models import User

with app.app_context():
    # Проверяем существование колонок и добавляем их
    from sqlalchemy import inspect, text
    
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    if 'telegram_chat_id' not in columns:
        db.engine.execute(text("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(50) NULL AFTER plan"))
    if 'enable_telegram_notifications' not in columns:
        db.engine.execute(text("ALTER TABLE users ADD COLUMN enable_telegram_notifications BOOLEAN DEFAULT FALSE AFTER telegram_chat_id"))
    if 'enable_email_notifications' not in columns:
        db.engine.execute(text("ALTER TABLE users ADD COLUMN enable_email_notifications BOOLEAN DEFAULT FALSE AFTER enable_telegram_notifications"))
    if 'alert_min_reliability' not in columns:
        db.engine.execute(text("ALTER TABLE users ADD COLUMN alert_min_reliability FLOAT DEFAULT 60.0 AFTER enable_email_notifications"))
    
    print("✅ Миграция завершена успешно!")
```

Сохраните этот код в файл `run_migration.py` и выполните:
```bash
python run_migration.py
```

## Проверка

После выполнения миграции проверьте структуру таблицы:

```sql
DESCRIBE users;
```

Должны появиться новые колонки:
- `telegram_chat_id`
- `enable_telegram_notifications`
- `enable_email_notifications`
- `alert_min_reliability`




