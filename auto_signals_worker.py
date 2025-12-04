"""
Фоновая задача для автоматической проверки и отправки сигналов.
Запускается через cron или как отдельный процесс.
"""
import os
import sys
from datetime import datetime, timedelta
import logging

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, User
from trading_app import run_analysis
from app import send_email_notification, send_telegram_notification, format_alert_message

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auto_signals.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Интервалы проверки в зависимости от типа торговли (в минутах)
TRADING_TYPE_INTERVALS = {
    "Скальпинг": 5,
    "Дейтрейдинг": 30,
    "Свинг": 240,  # 4 часа
    "Среднесрочная": 1440,  # 1 день
    "Долгосрочная": 1440  # 1 день
}

def check_auto_signals():
    """Проверяет всех пользователей с включенными автоматическими сигналами."""
    with app.app_context():
        try:
            # Получаем всех пользователей с включенными автоматическими сигналами
            users = User.query.filter_by(auto_signals_enabled=True).all()
            
            if not users:
                logger.info("Нет пользователей с включенными автоматическими сигналами")
                return
            
            logger.info(f"Проверка автоматических сигналов для {len(users)} пользователей")
            
            for user in users:
                try:
                    # Проверяем, нужно ли выполнять проверку для этого пользователя
                    if not should_check_user(user):
                        continue
                    
                    # Выполняем анализ
                    result = run_analysis_for_user(user)
                    
                    if result and result.get("signal_found"):
                        # Отправляем уведомления
                        send_signal_notifications(user, result)
                        
                        # Обновляем информацию о последнем сигнале
                        user.auto_signal_last_signal_price = result.get("entry_price")
                        user.auto_signal_last_signal_direction = result.get("direction")
                    
                    # Обновляем время последней проверки
                    user.auto_signal_last_check = datetime.utcnow()
                    db.session.commit()
                    
                except Exception as e:
                    logger.error(f"Ошибка при проверке сигналов для пользователя {user.id}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    db.session.rollback()
                    continue
                    
        except Exception as e:
            logger.error(f"Критическая ошибка в check_auto_signals: {e}")
            import traceback
            logger.error(traceback.format_exc())

def should_check_user(user):
    """Проверяет, нужно ли выполнять проверку для пользователя."""
    if not user.auto_signal_symbol or not user.auto_signal_trading_type:
        logger.warning(f"Пользователь {user.id} не настроил символ или тип торговли")
        return False
    
    # Проверяем интервал
    if user.auto_signal_last_check:
        # Определяем интервал на основе типа торговли
        interval_minutes = TRADING_TYPE_INTERVALS.get(
            user.auto_signal_trading_type, 
            user.auto_signal_check_interval or 60
        )
        
        time_since_last_check = datetime.utcnow() - user.auto_signal_last_check
        if time_since_last_check.total_seconds() < interval_minutes * 60:
            logger.debug(f"Пропуск пользователя {user.id}: еще не прошло {interval_minutes} минут")
            return False
    
    return True

def run_analysis_for_user(user):
    """Выполняет анализ для пользователя с его настройками."""
    try:
        # Маппинг стратегий
        strategy_map = {
            "conservative": "Консервативная",
            "balanced": "Сбалансированная",
            "aggressive": "Агрессивная",
            "Консервативная": "Консервативная",
            "Сбалансированная": "Сбалансированная",
            "Агрессивная": "Агрессивная"
        }
        strategy = strategy_map.get(user.auto_signal_strategy, user.auto_signal_strategy or "Сбалансированная")
        
        # Маппинг типов торговли
        trading_type_map = {
            "scalping": "Скальпинг",
            "daytrading": "Дейтрейдинг",
            "swing": "Свинг",
            "medium_term": "Среднесрочная",
            "long_term": "Долгосрочная",
            "Скальпинг": "Скальпинг",
            "Дейтрейдинг": "Дейтрейдинг",
            "Свинг": "Свинг",
            "Среднесрочная": "Среднесрочная",
            "Долгосрочная": "Долгосрочная"
        }
        trading_type = trading_type_map.get(user.auto_signal_trading_type, user.auto_signal_trading_type or "Дейтрейдинг")
        
        logger.info(f"Выполнение анализа для пользователя {user.id}: {user.auto_signal_symbol}, {trading_type}, {strategy}")
        
        # Выполняем анализ
        (
            report_text,
            chart_bytes,
            excel_bytes,
            symbol,
            rr_long,
            rr_short,
            entry_price,
            exit_price,
            direction,
            trend,
            stop_loss,
            take_profit,
            reliability_rating,
            rsi_value,
            _  # Игнорируем report_markdown_raw, не нужен для уведомлений
        ) = run_analysis(
            user.auto_signal_symbol,
            timeframe=None,  # Автоматический таймфрейм
            strategy=strategy,
            trading_type=trading_type,
            capital=user.auto_signal_capital or 10000,
            risk=(user.auto_signal_risk or 1.0) / 100,
            range_days=None,
            confirmation=user.auto_signal_confirmation,
            min_reliability=user.auto_signal_min_reliability or 60.0,
            enable_forecast=False,
            enable_backtest=False,
            backtest_days=None,
            enable_ml=False,
            historical_reports=None,
            enable_trailing=False,
            trailing_percent=0.5,
            spread=getattr(user, 'exchange_spread', 0.0),
            language="ru"
        )
        
        # Проверяем, есть ли сигнал
        min_reliability = user.auto_signal_min_reliability or 60.0
        signal_found = (
            direction is not None and 
            reliability_rating >= min_reliability
        )
        
        # Защита от спама: не отправляем повторные сигналы для той же валюты
        # если цена не изменилась значительно (более 1%)
        if signal_found and user.auto_signal_last_signal_price:
            price_change = abs(entry_price - user.auto_signal_last_signal_price) / user.auto_signal_last_signal_price
            same_direction = (direction == user.auto_signal_last_signal_direction)
            
            if same_direction and price_change < 0.01:  # Изменение менее 1%
                logger.info(f"Пропуск сигнала для {user.id}: цена не изменилась значительно ({price_change*100:.2f}%)")
                signal_found = False
        
        logger.info(f"Результат анализа для пользователя {user.id}: signal_found={signal_found}, direction={direction}, reliability={reliability_rating}")
        
        return {
            "signal_found": signal_found,
            "symbol": symbol,
            "direction": direction,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "reliability_rating": reliability_rating,
            "trend": trend,
            "strategy": strategy,
            "report_text": report_text
        }
        
    except Exception as e:
        logger.error(f"Ошибка при выполнении анализа для пользователя {user.id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def send_signal_notifications(user, result):
    """Отправляет уведомления о сигнале пользователю."""
    try:
        alert_message = format_alert_message(
            result["symbol"],
            result["direction"],
            result["entry_price"],
            result["stop_loss"],
            result["take_profit"],
            result["reliability_rating"],
            result["strategy"],
            result["trend"],
            language="ru"
        )
        
        # Email уведомления
        if user.enable_email_notifications and user.email:
            email_subject = f"🚨 Автоматический сигнал: {result['symbol']} {result['direction'].upper()}"
            email_message = alert_message.replace("<b>", "").replace("</b>", "").replace("🚨", "🚨").replace("📊", "📊")
            if send_email_notification(user.email, email_subject, email_message):
                logger.info(f"✅ Email уведомление отправлено пользователю {user.id} ({user.email})")
            else:
                logger.warning(f"⚠️ Не удалось отправить Email уведомление пользователю {user.id}")
        
        # Telegram уведомления
        if user.enable_telegram_notifications and user.telegram_chat_id:
            telegram_message = alert_message.replace("<b>", "*").replace("</b>", "*")
            if send_telegram_notification(user.telegram_chat_id, telegram_message):
                logger.info(f"✅ Telegram уведомление отправлено пользователю {user.id} ({user.telegram_chat_id})")
            else:
                logger.warning(f"⚠️ Не удалось отправить Telegram уведомление пользователю {user.id}")
                
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомлений пользователю {user.id}: {e}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    # Запуск проверки
    logger.info("🚀 Запуск проверки автоматических сигналов...")
    check_auto_signals()
    logger.info("✅ Проверка завершена")



