# Инструкция по настройке на хостинге

## ⚠️ ВАЖНО: Настройка переменных окружения

На Hostinger переменные окружения **ОБЯЗАТЕЛЬНО** нужно настраивать через **панель управления**, а не только через файл `.env`!

### Способ 1: Через панель управления Hostinger (РЕКОМЕНДУЕТСЯ)

1. Войдите в **hPanel** (панель управления Hostinger)
2. Найдите раздел **"Node.js"** или **"Node.js Apps"**
3. Откройте ваше приложение
4. Найдите раздел **"Environment Variables"** или **"Переменные окружения"**
5. Добавьте все переменные из списка ниже (по одной)
6. **Сохраните** изменения
7. **Перезапустите** приложение через панель (кнопка "Restart" или "Reload")

### Способ 2: Через файл `.env` (если панель недоступна)

Если панель управления недоступна, можно использовать файл `.env`, но **обязательно перезапустите сервер** после изменений!

## Что нужно изменить в файле `.env` на хостинге:

### 1. Исправьте BASE_URL (уберите слэш в конце)

**Было:**
```env
BASE_URL=https://papayawhip-alpaca-835460.hostingersite.com/
```

**Должно быть:**
```env
BASE_URL=https://papayawhip-alpaca-835460.hostingersite.com
```

⚠️ **Важно:** Уберите слэш `/` в конце URL!

### 2. Добавьте переменную SMTP_FROM (опционально, но рекомендуется)

Для Resend рекомендуется использовать верифицированный домен. Если у вас есть верифицированный домен в Resend, добавьте:

```env
SMTP_FROM=noreply@yourdomain.com
```

Если домен не верифицирован, можно использовать:
```env
SMTP_FROM=onboarding@resend.dev
```

### 3. Проверьте все переменные окружения

Убедитесь, что в `.env` есть все необходимые переменные:

```env
# Порт для запуска сервера
PORT=3002

# Подключение к MySQL
DATABASE_URL="mysql://u543957720_crypto:AgUbbkD1h!@auth-db936.hstgr.io/u543957720_cryptoprice"

# Секрет для сессий
SESSION_SECRET="crypto-analyzer-secret-key-change-this"

# SMTP настройки для Resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_aJY2AAvt_KrbfPNiGWEcJLibcsgUJ7tnK

# BASE_URL БЕЗ слэша в конце!
BASE_URL=https://papayawhip-alpaca-835460.hostingersite.com

# Опционально: адрес отправителя (если есть верифицированный домен)
SMTP_FROM=noreply@yourdomain.com
```

## 📋 Полный список переменных окружения для добавления:

**Добавьте ВСЕ эти переменные в панели Hostinger (Environment Variables):**

```
PORT=3002
DATABASE_URL=mysql://u543957720_crypto:AgUbbkD1h!@auth-db936.hstgr.io/u543957720_cryptoprice
SESSION_SECRET=crypto-analyzer-secret-key-change-this
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_aJY2AAvt_KrbfPNiGWEcJLibcsgUJ7tnK
BASE_URL=https://papayawhip-alpaca-835460.hostingersite.com
SMTP_FROM=onboarding@resend.dev
```

⚠️ **Обратите внимание:**
- `BASE_URL` **БЕЗ** слэша в конце!
- `SMTP_PASS` - это ваш API ключ Resend (начинается с `re_`)
- `SMTP_FROM` можно изменить на верифицированный email, если есть

## После изменений:

1. **Сохраните** все переменные в панели Hostinger
2. **Перезапустите сервер** на хостинге (через панель управления)
3. **Подождите 10-30 секунд** после перезапуска
4. **Проверьте логи** при попытке отправить письмо
5. **Убедитесь**, что все переменные окружения загружены правильно

## Проверка работы:

1. Попробуйте запросить восстановление пароля
2. Проверьте логи сервера на наличие ошибок
3. Если ошибка 500, проверьте:
   - Правильность BASE_URL (без слэша)
   - Наличие всех SMTP переменных
   - Правильность SMTP_PASS (API ключ Resend)

## Возможные проблемы:

### Ошибка 500 при отправке email:
- Проверьте, что SMTP_PASS правильный (API ключ Resend)
- Убедитесь, что BASE_URL без слэша в конце
- Проверьте логи сервера для деталей ошибки

### Письма не приходят:
- Проверьте папку "Спам"
- Убедитесь, что домен верифицирован в Resend (если используете свой домен)
- Проверьте лимиты Resend на отправку писем

### Ошибка "SMTP configuration is incomplete":
- Убедитесь, что все SMTP переменные установлены в **панели Hostinger** (Environment Variables)
- Проверьте, что переменные загружаются при запуске сервера
- **Перезапустите сервер** после добавления переменных
- Проверьте логи сервера - там будет указано, какие именно переменные отсутствуют

## Логи для отладки:

После изменений в коде, при отправке письма будут выводиться детальные логи:
- Попытка отправки email (from, to, subject)
- Успешная отправка (messageId)
- Детали ошибок (message, code, response)

Проверьте логи сервера для диагностики проблем.

## 📝 Применение изменений на сервере (Laravel):

### 1. Загрузите обновленные файлы на сервер:

#### Способ 1: Через SCP (с локального компьютера)

Если у вас есть доступ к файлам на локальном компьютере, используйте `scp`:

```bash
# С локального компьютера (Windows PowerShell или Linux/Mac терминал)
scp server-php/app/Http/Controllers/AuthController.php u543957720@fr-int-web936.hostingersite.com:~/public_html/api/app/Http/Controllers/
scp server-php/routes/api.php u543957720@fr-int-web936.hostingersite.com:~/public_html/api/routes/
scp server-php/app/Models/User.php u543957720@fr-int-web936.hostingersite.com:~/public_html/api/app/Models/
scp server-php/database/migrations/2025_01_20_000000_add_email_verification_fields_to_users_table.php u543957720@fr-int-web936.hostingersite.com:~/public_html/api/database/migrations/
```

#### Способ 2: Через SSH (создание файлов на сервере)

Если файлы уже открыты в редакторе, скопируйте их содержимое и создайте файлы на сервере:

**1. AuthController.php:**
```bash
cd ~/public_html/api/app/Http/Controllers
nano AuthController.php
# Вставьте содержимое файла, нажмите Ctrl+O для сохранения, Enter, Ctrl+X для выхода
```

**2. api.php (роуты):**
```bash
cd ~/public_html/api/routes
nano api.php
# Вставьте содержимое файла, сохраните (Ctrl+O, Enter, Ctrl+X)
```

**3. User.php (модель):**
```bash
cd ~/public_html/api/app/Models
nano User.php
# Вставьте содержимое файла, сохраните (Ctrl+O, Enter, Ctrl+X)
```

**4. Миграция:**
```bash
cd ~/public_html/api/database/migrations
nano 2025_01_20_000000_add_email_verification_fields_to_users_table.php
# Вставьте содержимое файла, сохраните (Ctrl+O, Enter, Ctrl+X)
```

**Альтернатива nano - использование cat:**
```bash
# Создайте файл и вставьте содержимое
cat > ~/public_html/api/app/Http/Controllers/AuthController.php << 'EOF'
# Вставьте содержимое файла здесь
# Нажмите Enter, затем введите EOF на новой строке
EOF
```

### 2. Запустите миграцию на сервере:

```bash
cd ~/public_html/api
php artisan migrate
```

### 3. Проверьте настройки .env:

Убедитесь, что в `api/.env` есть все настройки SMTP (см. выше).

### 4. Очистите кеш Laravel:

```bash
cd ~/public_html/api
php artisan config:clear
php artisan cache:clear
```

### 5. Проверьте логи:

```bash
tail -f api/storage/logs/laravel.log
```

После этого попробуйте зарегистрироваться или запросить восстановление пароля.


