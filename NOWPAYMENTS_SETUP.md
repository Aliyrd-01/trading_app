# Инструкция по настройке NOWPayments

## Что реализовано:

1. ✅ Контроллер платежей (`PaymentController.php`)
2. ✅ Эндпоинт создания платежа (`/api/payment/create`)
3. ✅ Webhook обработчик (`/api/payment/webhook`)
4. ✅ Проверка статуса платежа (`/api/payment/status`)
5. ✅ Интеграция на странице Price - при нажатии на кнопку Pro/Pro Plus создается платеж

## Настройка на сервере:

### 1. Загрузите файлы на сервер:

**PHP файлы (через SSH или FTP):**
- `server-php/app/Http/Controllers/PaymentController.php`
- `server-php/app/Models/Payment.php` (новый файл)
- `server-php/routes/api.php` (обновленный)
- `server-php/database/migrations/2025_01_20_120000_create_payments_table.php` (новая миграция)

**Фронтенд (пересоберите проект):**
- `client/src/pages/Prices.tsx` (обновленный)
- `client/src/lib/i18n.tsx` (обновленный)

### 2. Добавьте переменные окружения в `api/.env`:

```bash
NOWPAYMENTS_API_KEY=55VMB5S-8RR425Z-JXW9GJF-G0R681E
NOWPAYMENTS_IPN_SECRET=YSmQvbnGnobQuHSae4kUBXJROL727sTj
```

Или через SSH:

```bash
cd ~/public_html/api
echo "" >> .env
echo "NOWPAYMENTS_API_KEY=55VMB5S-8RR425Z-JXW9GJF-G0R681E" >> .env
echo "NOWPAYMENTS_IPN_SECRET=YSmQvbnGnobQuHSae4kUBXJROL727sTj" >> .env
```

### 3. Запустите миграцию для создания таблицы payments:

```bash
cd ~/public_html/api
php artisan migrate
```

Если возникнет ошибка, выполните SQL вручную:

```sql
CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    payment_id VARCHAR(255) NULL,
    plan VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    pay_currency VARCHAR(10) DEFAULT 'ETH',
    payment_status VARCHAR(50) NULL,
    pay_status VARCHAR(50) NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_payment_id (payment_id),
    INDEX idx_user_id (user_id)
);
```

### 4. Очистите кеш Laravel:

```bash
php artisan config:clear
php artisan cache:clear
```

### 5. Настройте webhook в панели NOWPayments:

1. Зайдите в панель NOWPayments
2. Найдите раздел "IPN Settings" или "Webhooks"
3. Добавьте URL для webhook:
   ```
   https://papayawhip-alpaca-835460.hostingersite.com/api/payment/webhook
   ```
4. Убедитесь, что IPN Secret Key совпадает с тем, что в `.env`

## Как это работает:

1. Пользователь нажимает кнопку "Buy Now" на плане Pro или Pro Plus
2. Создается платеж через NOWPayments API
3. Пользователь перенаправляется на страницу оплаты NOWPayments
4. После успешной оплаты NOWPayments отправляет webhook на ваш сервер
5. Сервер обновляет план пользователя в базе данных (`plan = 'pro'` или `plan = 'pro_plus'`)

## Цены планов:

- **Pro**: $10/месяц (старая цена $15 перечеркнута, со скидкой)
- **Pro Plus**: $20/месяц
- **Валюта оплаты**: ETH (пока только ETH)

## Проверка работы:

1. Зарегистрируйтесь и войдите
2. Перейдите на страницу Price
3. Нажмите "Buy Now" на плане Pro или Pro Plus
4. Должна открыться страница оплаты NOWPayments
5. После тестовой оплаты план должен обновиться автоматически

## Отладка:

Проверьте логи Laravel для отладки:

```bash
tail -f storage/logs/laravel.log
```

В логах будут видны:
- Создание платежей
- Обработка webhook
- Ошибки при работе с NOWPayments API

