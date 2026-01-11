# Инструкция по развертыванию на Hostinger

## Требования
- PHP 8.2.29 (уже установлен на Hostinger)
- MySQL база данных (уже настроена)
- Composer (должен быть доступен через SSH или панель управления)

## Шаги развертывания

### 1. Подготовка файлов

Все файлы из папки `server-php` нужно загрузить на сервер через FTP.

**Важно:** Не загружайте папки:
- `node_modules/` (если есть)
- `.git/`
- `storage/logs/*` (но саму папку `storage/` нужно загрузить)
- `.env` (создадим на сервере)

### 2. Структура на сервере

На Hostinger обычно структура такая:
```
public_html/
  ├── index.php (из server-php/public/index.php)
  ├── .htaccess (из server-php/public/.htaccess)
  └── ... (остальные файлы Laravel в корне или в подпапке)
```

**Рекомендуемая структура:**
- Загрузите все файлы Laravel в корень `public_html/` или в подпапку (например, `public_html/api/`)
- Если загружаете в подпапку, нужно будет настроить `.htaccess` для перенаправления

### 3. Установка зависимостей

Через SSH (если доступен):
```bash
cd /path/to/your/project
composer install --no-dev --optimize-autoloader
```

Или через панель управления Hostinger (если есть встроенный Composer):
- Найдите опцию "Composer" в панели
- Выберите папку проекта
- Нажмите "Install"

**Если Composer недоступен:**
- Установите зависимости локально на своем компьютере
- Загрузите папку `vendor/` на сервер через FTP

### 4. Настройка .env файла

Создайте файл `.env` в корне проекта на сервере со следующим содержимым:

```env
APP_NAME=CryptoInsightX
APP_ENV=production
APP_KEY=base64:ВАШ_СГЕНЕРИРОВАННЫЙ_КЛЮЧ
APP_DEBUG=false
APP_URL=https://ваш-домен.com

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=89.116.147.105
DB_PORT=3306
DB_DATABASE=u543957720_cryptoprice
DB_USERNAME=u543957720_crypto
DB_PASSWORD=AgUbbkD1h!

SESSION_DRIVER=file
SESSION_LIFETIME=10080
SESSION_SECURE_COOKIE=true

CACHE_DRIVER=file
QUEUE_CONNECTION=sync
```

**Генерация APP_KEY:**
Через SSH:
```bash
php artisan key:generate
```

Или вручную сгенерируйте ключ (32 символа) и добавьте `base64:` перед ним.

### 5. Настройка прав доступа

Установите права на папки:
```bash
chmod -R 755 storage
chmod -R 755 bootstrap/cache
```

Или через FTP клиент:
- `storage/` - права 755
- `bootstrap/cache/` - права 755

### 6. Настройка .htaccess для API

Если Laravel находится в корне `public_html/`, создайте или обновите `.htaccess`:

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

### 7. Настройка CORS (если нужно)

Если фронтенд на другом домене, убедитесь что в `config/cors.php`:
- `'supports_credentials' => true`
- `'allowed_origins'` содержит ваш домен фронтенда

### 8. Проверка работы

1. Проверьте доступность API:
   ```
   GET https://ваш-домен.com/api/auth/me
   ```
   Должен вернуть 401 (не авторизован) - это нормально.

2. Проверьте регистрацию:
   ```
   POST https://ваш-домен.com/api/auth/register
   Content-Type: application/json
   
   {
     "email": "test@example.com",
     "password": "password123"
   }
   ```

3. Проверьте логи в `storage/logs/laravel.log` при ошибках

### 9. Настройка фронтенда

В файле `client/src/lib/auth.tsx` убедитесь, что запросы идут на правильный URL:
- Если Laravel в корне: `/api/auth/...`
- Если Laravel в подпапке: `/api/api/auth/...` (нужно будет настроить)

### 10. Оптимизация (опционально)

После успешного развертывания:
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Решение проблем

### Ошибка 500
- Проверьте права на папки `storage/` и `bootstrap/cache/`
- Проверьте логи в `storage/logs/laravel.log`
- Убедитесь что `.env` файл создан и содержит правильные данные

### Ошибка подключения к БД
- Проверьте данные в `.env`
- Убедитесь что хост БД доступен с сервера
- Проверьте что пользователь БД имеет права на базу данных

### Сессии не работают
- Проверьте права на `storage/framework/sessions/`
- Убедитесь что `SESSION_DRIVER=file` в `.env`
- Проверьте что куки отправляются (в DevTools браузера)

### CORS ошибки
- Проверьте настройки в `config/cors.php`
- Убедитесь что `supports_credentials => true`
- Проверьте заголовки ответа в DevTools

## Контакты и поддержка

Если возникнут проблемы, проверьте:
1. Логи Laravel: `storage/logs/laravel.log`
2. Логи веб-сервера (через панель Hostinger)
3. Настройки PHP (версия, расширения)

















