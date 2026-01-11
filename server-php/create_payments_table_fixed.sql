-- SQL для создания таблицы payments (исправленная версия)
-- Сначала проверьте тип id в таблице users:
-- DESCRIBE users;

-- Если users.id имеет тип INT, используйте этот SQL:
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;





