# Трейлинг-стоп: Текущая реализация и возможности

## 📊 Текущая реализация

**Что делает сейчас:**
- Рассчитывает уровни стоп-лосса на основе **прогнозируемой прибыли**
- Используется только в **режиме анализа/прогноза**
- Показывает, где **мог бы быть** стоп-лосс, если бы цена двигалась в прибыльную сторону

**Ограничения:**
- ❌ Не отслеживает реальные изменения цены в реальном времени
- ❌ Не обновляет стоп-лосс автоматически при движении цены
- ❌ Не интегрирован с торговым API биржи
- ❌ Не может закрыть позицию автоматически

## 🚀 Для реального использования требуется

### Вариант 1: Модуль мониторинга цены (WebSocket)

**Что нужно:**
1. WebSocket подключение к бирже (Binance WebSocket API)
2. Фоновый процесс, отслеживающий цену в реальном времени
3. Логика обновления стоп-лосса при достижении новых максимумов/минимумов
4. Хранение активных позиций в БД

**Пример реализации:**
```python
# price_monitor.py
import ccxt
import asyncio
from websocket import create_connection

class TrailingStopMonitor:
    def __init__(self, symbol, entry_price, direction, trailing_percent):
        self.symbol = symbol
        self.entry_price = entry_price
        self.direction = direction  # 'long' или 'short'
        self.trailing_percent = trailing_percent
        self.highest_price = entry_price  # для лонга
        self.lowest_price = entry_price   # для шорта
        self.current_stop_loss = None
        
    def update_price(self, current_price):
        if self.direction == 'long':
            # Обновляем максимум
            if current_price > self.highest_price:
                self.highest_price = current_price
                # Пересчитываем стоп-лосс
                profit = current_price - self.entry_price
                trailing_distance = profit * self.trailing_percent
                self.current_stop_loss = self.entry_price + trailing_distance
                
            # Проверяем, не достигнут ли стоп-лосс
            if current_price <= self.current_stop_loss:
                return "STOP_HIT"
                
        elif self.direction == 'short':
            # Обновляем минимум
            if current_price < self.lowest_price:
                self.lowest_price = current_price
                # Пересчитываем стоп-лосс
                profit = self.entry_price - current_price
                trailing_distance = profit * self.trailing_percent
                self.current_stop_loss = self.entry_price - trailing_distance
                
            # Проверяем, не достигнут ли стоп-лосс
            if current_price >= self.current_stop_loss:
                return "STOP_HIT"
                
        return "ACTIVE"
```

### Вариант 2: Периодический опрос через API

**Что нужно:**
1. Фоновый процесс (Celery/APScheduler)
2. Периодический запрос текущей цены через REST API
3. Обновление стоп-лосса в БД
4. Проверка условий закрытия позиции

**Пример:**
```python
# scheduled_trailing.py
from apscheduler.schedulers.background import BackgroundScheduler
import ccxt

def check_trailing_stops():
    exchange = ccxt.binance()
    # Получаем активные позиции из БД
    active_positions = get_active_positions_with_trailing()
    
    for position in active_positions:
        # Получаем текущую цену
        ticker = exchange.fetch_ticker(position.symbol)
        current_price = ticker['last']
        
        # Обновляем стоп-лосс
        new_stop_loss = calculate_trailing_stop(
            position.entry_price,
            current_price,
            position.direction,
            position.trailing_percent
        )
        
        # Проверяем, нужно ли закрыть позицию
        if should_close_position(current_price, new_stop_loss, position.direction):
            close_position(position, current_price)
        else:
            update_stop_loss(position, new_stop_loss)

# Запускаем каждые 5 секунд
scheduler = BackgroundScheduler()
scheduler.add_job(check_trailing_stops, 'interval', seconds=5)
scheduler.start()
```

### Вариант 3: Интеграция с торговым ботом

**Что нужно:**
1. Торговый бот (например, на основе python-binance)
2. WebSocket для отслеживания цены
3. Автоматическое размещение/обновление стоп-лосса через API биржи
4. Управление позициями через ордера биржи

**Пример:**
```python
# trading_bot.py
from binance.client import Client
from binance.websocket import BinanceSocketManager

class TradingBot:
    def __init__(self, api_key, api_secret):
        self.client = Client(api_key, api_secret)
        self.bm = BinanceSocketManager(self.client)
        
    def start_trailing_stop(self, symbol, entry_price, direction, trailing_percent):
        # Открываем WebSocket для отслеживания цены
        self.bm.start_symbol_ticker_socket(
            symbol,
            self.on_price_update
        )
        
    def on_price_update(self, msg):
        current_price = float(msg['c'])  # текущая цена
        
        # Логика обновления трейлинг-стопа
        # ...
        
        # Если достигнут стоп-лосс - закрываем позицию через API
        if stop_loss_hit:
            self.client.create_order(
                symbol=symbol,
                side='SELL' if direction == 'long' else 'BUY',
                type='MARKET',
                quantity=position_size
            )
```

## 📋 Рекомендации по реализации

### Минимальный вариант (для начала):
1. **Добавить таблицу `active_positions` в БД:**
   ```sql
   CREATE TABLE active_positions (
       id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT,
       symbol VARCHAR(20),
       direction VARCHAR(10),
       entry_price DECIMAL(20,8),
       current_stop_loss DECIMAL(20,8),
       trailing_percent DECIMAL(5,2),
       status VARCHAR(20),
       created_at DATETIME,
       FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

2. **Создать API endpoint для запуска мониторинга:**
   ```python
   @app.route("/api/start_trailing_monitor", methods=["POST"])
   def start_trailing_monitor():
       # Сохраняем позицию в БД
       # Запускаем фоновый процесс мониторинга
   ```

3. **Создать фоновый процесс (Celery или простой Thread):**
   ```python
   def monitor_trailing_stops():
       while True:
           check_all_active_positions()
           time.sleep(5)  # проверка каждые 5 секунд
   ```

### Полноценный вариант:
1. Использовать **Celery** для фоновых задач
2. **WebSocket** подключение к Binance для реального времени
3. Интеграция с **Trading API** для автоматического закрытия позиций
4. **Уведомления** при срабатывании стоп-лосса
5. **Логирование** всех изменений стоп-лосса

## ⚠️ Важные замечания

1. **Безопасность:** При работе с реальными деньгами нужна тщательная проверка логики
2. **Задержки:** API запросы имеют задержку, WebSocket быстрее
3. **Ошибки сети:** Нужна обработка разрывов соединения и повторные попытки
4. **Комиссии:** Учитывайте комиссии биржи при расчете прибыли
5. **Тестирование:** Сначала тестируйте на тестовой сети (testnet)

## 🔄 Следующие шаги

Если хотите реализовать реальный трейлинг-стоп, я могу:
1. Создать модуль мониторинга цены через WebSocket
2. Добавить таблицу для активных позиций в БД
3. Реализовать API для управления мониторингом
4. Добавить интеграцию с торговым API (если есть ключи)

**Важно:** Для реальной торговли нужны API ключи от биржи с правами на торговлю.

























