#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import traceback
import ccxt
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import requests
from scipy.stats import norm

LOCAL_TZ = ZoneInfo("Europe/Kyiv")
exchange = ccxt.binance({"enableRateLimit": True, "timeout": 20000})

# --- Конфигурация ---
STRATEGIES = {
    "Консервативная": {"entry_type": "ema50", "atr_sl": 1.5, "atr_tp": 1.8, "ema_buffer": 0.001, "rsi_filter": 55},
    "Сбалансированная": {"entry_type": "ema20", "atr_sl": 1.2, "atr_tp": 1.8, "ema_buffer": 0.0007, "rsi_filter": 50},
    "Агрессивная": {"entry_type": "close", "atr_sl": 1.0, "atr_tp": 1.5, "ema_buffer": 0.0, "rsi_filter": 45},
}

TRADING_TYPES = {
    "Скальпинг": {"mult_sl": 0.8, "mult_tp": 1.0, "hold": "минуты–час"},
    "Дейтрейдинг": {"mult_sl": 1.0, "mult_tp": 1.3, "hold": "в течение дня"},
    "Свинг": {"mult_sl": 1.5, "mult_tp": 2.0, "hold": "2–5 дней"},
    "Среднесрочная": {"mult_sl": 2.0, "mult_tp": 3.0, "hold": "недели"},
    "Долгосрочная": {"mult_sl": 3.0, "mult_tp": 4.0, "hold": "месяцы"},
}

DEFAULT_TIMEFRAMES = {
    "Скальпинг": "5m",
    "Дейтрейдинг": "1h",
    "Свинг": "4h",
    "Среднесрочная": "1d",
    "Долгосрочная": "1w",
}

TRADING_HISTORY_DAYS = {
    "Скальпинг": 7,
    "Дейтрейдинг": 30,
    "Свинг": 90,
    "Среднесрочная": 180,
    "Долгосрочная": 180,
}

# Маппинг для переводов
TRADING_TYPE_MAP = {
    "Скальпинг": "scalping",
    "Дейтрейдинг": "daytrading", 
    "Свинг": "swing",
    "Среднесрочная": "medium_term",
    "Долгосрочная": "long_term"
}

STRATEGY_MAP = {
    "Консервативная": "conservative",
    "Сбалансированная": "balanced",
    "Агрессивная": "aggressive"
}

# === Переводы для отчета ===
REPORT_TRANSLATIONS = {
    "ru": {
        "report_title": "Аналитический отчёт по",
        "generated": "Сгенерировано:",
        "current_market": "Текущий рынок (bias):",
        "bullish": "Бычий",
        "bearish": "Медвежий",
        "summary_title": "📈 Краткое резюме",
        "indicator": "Показатель",
        "value": "Значение",
        "interpretation": "Интерпретация",
        "current_price": "Текущая цена",
        "moving_direction": "Направление скользящих",
        "avg_volatility": "Средняя волатильность рынка",
        "user_confirmations": "Выбранные подтверждения (пользователь)",
        "result": "Результат:",
        "reliability_rating": "🎯 Рейтинг надёжности сигнала",
        "confidence_index": "📊 Сводный индекс уверенности",
        "very_high_confidence": "Очень высокая уверенность",
        "high_confidence": "Высокая уверенность",
        "medium_confidence": "Средняя уверенность",
        "low_confidence": "Низкая уверенность",
        "extreme_fear": "Крайний страх",
        "fear": "Страх",
        "neutral": "Нейтрально",
        "greed": "Жадность",
        "extreme_greed": "Крайняя жадность",
        "high": "Высокая",
        "medium": "Средняя",
        "low": "Низкая",
        "strategy_title": "⚙️ Стратегия",
        "trading_type_label": "Тип торговли:",
        "strategy_label": "Стратегия:",
        "capital_label": "Капитал:",
        "dynamic_risk": "Динамический риск:",
        "base_risk": "базовый",
        "confirmation_type": "Тип подтверждения:",
        "levels_title": "🎯 Уровни",
        "long": "Лонг",
        "short": "Шорт",
        "parameter": "Параметр",
        "distance": "Расстояние",
        "trigger_buy": "Триггер (buy-stop)",
        "trigger_sell": "Триггер (sell-stop)",
        "stop_loss": "Стоп-лосс",
        "take_profit": "Take-profit",
        "position_size": "Размер позиции",
        "psychological_levels_title": "🎯 Психологические уровни",
        "psychological_levels_desc": "Ближайшие психологические уровни (круглые числа) могут служить дополнительными уровнями поддержки/сопротивления:",
        "psychological_levels_not_found": "Психологические уровни не найдены",
        "price": "Цена",
        "perspective_title": "💰 Перспектива",
        "more_perspective": "Более перспективно:",
        "trend": "Тренд:",
        "bull_market": "Бычий рынок",
        "bear_market": "Медвежий рынок",
        "oversold": "Перепроданность",
        "overbought": "Перекупленность",
        "neutral_zone": "Нейтральная зона",
        "within_bounds": "В пределах границ",
        "out_of_bounds": "Выход за пределы",
        "upward_momentum": "Восходящий импульс",
        "downward_momentum": "Нисходящий импульс",
        "strong_trend": "Сильный тренд",
        "weak_trend": "Слабый тренд",
        "medium_trend": "Средний тренд",
        "recommendations_title": "💡 Дополнительные рекомендации",
        "candlestick_title": "🕯️ Свечной анализ",
        "candlestick_desc": "Распознанные свечные паттерны в последних свечах:",
        "candlestick_not_found": "Свечные паттерны не обнаружены в последних свечах",
        "candlestick_interpretation_title": "Как трактовать:",
        "candlestick_interpretation_text": "Свечной анализ основан на паттернах японских свечей. Каждый паттерн показывает настроение рынка: бычьи паттерны (зеленые) указывают на возможный рост, медвежьи (красные) — на возможное падение. Сила сигнала зависит от контекста и подтверждения другими индикаторами.",
        "btc_comparison_title": "📈 Сравнение с BTC/USDT",
        "additional_metrics_title": "📊 Дополнительные метрики",
        "price_movement_probabilities": "Вероятности движения цены:",
        "probability_up_1": "Вероятность роста на 1%:",
        "probability_up_2": "Вероятность роста на 2%:",
        "probability_up_5": "Вероятность роста на 5%:",
        "confidence_interpretation": "Интерпретация сводного индекса уверенности ({confidence}%):",
        "very_high_confidence_desc": "✅ Очень высокая уверенность в сигнале — все компоненты указывают в одном направлении",
        "high_confidence_desc": "✅ Высокая уверенность — большинство факторов подтверждают сигнал",
        "medium_confidence_desc": "⚠️ Средняя уверенность — сигнал подтверждён частично, требуется осторожность",
        "low_confidence_desc": "❌ Низкая уверенность — сигнал слабый, рекомендуется воздержаться от входа",
        "pattern": "Паттерн",
        "description": "Описание",
        "reliability_warning": "⚠️ **ВНИМАНИЕ:** Рейтинг надёжности сигнала ({rating}%) ниже минимального порога ({min}%). Рекомендуется воздержаться от входа.",
        "no_confirmations": "Нет выбранных подтверждений",
        # Переводы для типов торговли
        "trading_type_scalping": "Скальпинг",
        "trading_type_daytrading": "Дейтрейдинг",
        "trading_type_swing": "Свинг",
        "trading_type_medium_term": "Среднесрочная",
        "trading_type_long_term": "Долгосрочная",
        # Переводы для стратегий
        "strategy_conservative": "Консервативная",
        "strategy_balanced": "Сбалансированная",
        "strategy_aggressive": "Агрессивная",
        # Переводы для рекомендаций
        "rec_market_flat": "Рынок во флете — лучше воздержаться от входов.",
        "rec_rsi_oversold": "RSI < 30 — перепроданность, возможен отскок вверх.",
        "rec_rsi_overbought": "RSI > 70 — перекупленность, возможна коррекция.",
        "rec_ema_bullish": "EMA50 выше EMA200 — общий фон бычий, лонги предпочтительнее.",
        "rec_ema_bearish": "EMA50 ниже EMA200 — общий фон медвежий, рассматривать шорты осторожно.",
        "rec_vwma_below": "Цена ниже VWMA — давление продавцов усиливается.",
        "rec_vwma_above": "Цена выше VWMA — восходящий импульс сохраняется.",
        # Переводы для свечных паттернов
        "pattern_doji": "Доджи - неопределенность, возможен разворот",
        "pattern_inverted_hammer": "Перевернутый молот - возможен разворот вверх",
        "pattern_hammer": "Молот - возможен разворот вверх",
        "pattern_shooting_star": "Падающая звезда - возможен разворот вниз",
        "pattern_bullish_engulfing": "Бычье поглощение - возможен разворот вверх",
        "pattern_bearish_engulfing": "Медвежье поглощение - возможен разворот вниз",
        # Переводы для прогноза
        "forecast_title": "📊 Прогноз на основе истории",
        "forecast_analysis": "Анализ {cases} похожих ситуаций в истории:",
        "forecast_success_prob": "🎯 Вероятность успеха:",
        "forecast_expected_profit": "💰 Ожидаемая прибыль:",
        "forecast_range": "📊 Диапазон возможных результатов: от {min}% до {max}%",
        "forecast_note": "*Примечание: диапазон показывает минимальный и максимальный результат из похожих ситуаций в истории*",
        # Переводы для управления позицией
        "position_management_title": "=== Управление позицией ===",
        "position_stop_loss": "Stop Loss:",
        "position_take_profit": "Take Profit:",
        "position_risk_reward": "Risk/Reward:",
        "position_size_label": "Position:",
        "position_explanation": "*Пояснение: units — количество единиц актива ({asset}), ${dollars} — стоимость позиции в долларах*",
        "historical_volatility": "Историческая волатильность",
        "partially_confirmed": "Частично подтверждено",
        "backtest_results_title": "Результаты бэктеста",
        "backtest_last_days": "последние {days} дней",
        "backtest_total_trades": "Всего сделок",
        "backtest_winning_trades": "Прибыльных",
        "backtest_losing_trades": "Убыточных",
        "backtest_win_rate": "Win Rate",
        "backtest_total_profit": "Общая прибыль",
        "backtest_max_drawdown": "Максимальная просадка",
        "backtest_avg_rr": "Средний R:R",
        "backtest_final_capital": "Финальный капитал",
        "all_confirmations": "Все подтверждения",
        # Ошибки и сообщения
        "error_user_not_found": "Пользователь не найден",
        "error_invalid_password": "Неверный пароль",
        "error_unauthorized": "Требуется авторизация",
        "error_unauthorized_short": "Неавторизован",
        "error_no_data": "Нет данных",
        "error_binance_connection": "Не удалось подключиться к Binance API. Проверьте интернет-соединение.",
        "error_binance_dns": "Ошибка DNS или сетевого подключения",
        "error_binance_server": "Ошибка подключения к Binance API. Сервер недоступен.",
        "error_binance_data": "Ошибка при получении данных: {error}",
        "error_binance_no_data": "Не удалось получить данные от Binance API",
        "error_settings_saved": "Настройки сохранены",
        "error_spread_range": "Спред должен быть от 0 до 1%",
        "error_trading_settings_saved": "Настройки торговли сохранены",
        "error_message_empty": "Сообщение не может быть пустым",
        "error_message_sent": "Сообщение отправлено",
        "error_message_failed": "Не удалось отправить сообщение",
        "error_unknown": "Неизвестная ошибка",
        "error_insufficient_data": "Недостаточно данных",
        "error_insufficient_data_atr": "Недостаточно данных для расчёта ATR (требуется минимум 14 строк)",
        "error_analysis": "Ошибка анализа",
        "error_symbol_not_found": "не найдена на бирже",
        "error_symbol_not_traded": "Возможно, данная пара не торгуется на Binance.",
        "error_load_data": "Ошибка загрузки данных",
        "no_data_available": "Нет данных для отображения",
        # Уведомления
        "notification_new_signal": "Новый торговый сигнал!",
        "notification_instrument": "Инструмент:",
        "notification_direction": "Направление:",
        "notification_trend": "Тренд:",
        "notification_strategy": "Стратегия:",
        "notification_levels": "Уровни:",
        "notification_entry": "Вход:",
        "notification_stop_loss": "Стоп-лосс:",
        "notification_take_profit": "Take Profit:",
        "notification_rr": "R:R:",
        "notification_reliability": "Надёжность:",
        # Статистика
        "stats_successful": "Успешные",
        "stats_unsuccessful": "Неуспешные",
        "stats_distribution_result": "Распределение сделок по результату",
        "stats_distribution_instruments": "Распределение сделок по инструментам",
        "long_direction": "Лонг 🚀",
        "short_direction": "Шорт 📉",
        "rsi_label": "RSI:",
        "range_label": "Диапазон:",
        "vwma_label": "VWMA:",
        "adx_label": "ADX:",
        "chart_entry": "Entry",
        "chart_stop_loss": "Stop Loss",
        "chart_take_profit": "Take Profit",
        "chart_trailing_stop": "Trailing Stop Loss",
        "rr_label": "R:R",
        "ml_forecast_title": "🤖 ML-прогноз вероятности успеха",
        "ml_forecast_analysis": "Анализ на основе похожих паттернов индикаторов:",
        "ml_forecast_success_prob": "🎯 Вероятность успеха:",
        "ml_forecast_similar_cases": "📊 Похожих случаев в истории:",
        "ml_forecast_confidence": "⚡ Уровень уверенности:",
        "confidence_high": "Высокий",
        "confidence_medium": "Средний",
        "confidence_low": "Низкий",
        "perspective_flat": "Рынок во флете ⚖️",
        "perspective_uncertain": "Тренд неопределён — формируется движение ⚖️",
        "perspective_bullish": "Явный бычий тренд 🚀",
        "perspective_bearish": "Явный медвежий тренд 📉",
        "perspective_mixed": "Тренд выражен, но подтверждения неоднозначны 🔄",
        # Ошибки и сообщения
        "error_user_not_found": "Пользователь не найден",
        "error_invalid_password": "Неверный пароль",
        "error_unauthorized": "Требуется авторизация",
        "error_unauthorized_short": "Неавторизован",
        "error_no_data": "Нет данных",
        "error_binance_connection": "Не удалось подключиться к Binance API. Проверьте интернет-соединение.",
        "error_binance_dns": "Ошибка DNS или сетевого подключения",
        "error_binance_server": "Ошибка подключения к Binance API. Сервер недоступен.",
        "error_binance_data": "Ошибка при получении данных: {error}",
        "error_binance_no_data": "Не удалось получить данные от Binance API",
        "error_settings_saved": "Настройки сохранены",
        "error_spread_range": "Спред должен быть от 0 до 1%",
        "error_trading_settings_saved": "Настройки торговли сохранены",
        "error_message_empty": "Сообщение не может быть пустым",
        "error_message_sent": "Сообщение отправлено",
        "error_message_failed": "Не удалось отправить сообщение",
        "error_unknown": "Неизвестная ошибка",
        "error_insufficient_data": "Недостаточно данных",
        "error_insufficient_data_atr": "Недостаточно данных для расчёта ATR (требуется минимум 14 строк)",
        "error_analysis": "Ошибка анализа",
        "error_symbol_not_found": "не найдена на бирже",
        "error_symbol_not_traded": "Возможно, данная пара не торгуется на Binance.",
        "error_load_data": "Ошибка загрузки данных",
        "no_data_available": "Нет данных для отображения",
        # Уведомления
        "notification_new_signal": "Новый торговый сигнал!",
        "notification_instrument": "Инструмент:",
        "notification_direction": "Направление:",
        "notification_trend": "Тренд:",
        "notification_strategy": "Стратегия:",
        "notification_levels": "Уровни:",
        "notification_entry": "Вход:",
        "notification_stop_loss": "Стоп-лосс:",
        "notification_take_profit": "Take Profit:",
        "notification_rr": "R:R:",
        "notification_reliability": "Надёжность:",
        "notification_time": "Время:",
        # Индикаторы для таблицы
        "indicator_close": "Close",
        "indicator_ema": "EMA20 / EMA50 / EMA200",
        "indicator_rsi": "RSI(14)",
        "indicator_atr": "ATR(14)",
        "indicator_trend": "Trend",
        "indicator_vwma": "VWMA(20)",
        "indicator_adx": "ADX",
        # R:R переводы
        "risk_reward_ratio_title": "📊 Соотношение Ризик:Прибыль (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        # Статистика
        "stats_successful": "Успешные",
        "stats_unsuccessful": "Неуспешные",
        "stats_distribution_result": "Распределение сделок по результату",
        "stats_distribution_instruments": "Распределение сделок по инструментам",
        # Переводы для heatmap графиков
        "heatmap_profit_pct": "Прибыль (%)",
        "heatmap_by_hour_title": "Прибыльность по часам дня",
        "heatmap_by_day_title": "Прибыльность по дням недели",
        "heatmap_hour_label": "Час дня (UTC)",
        "heatmap_day_label": "День недели",
        "heatmap_instrument_label": "Инструмент",
        "heatmap_day_mon": "Пн",
        "heatmap_day_tue": "Вт",
        "heatmap_day_wed": "Ср",
        "heatmap_day_thu": "Чт",
        "heatmap_day_fri": "Пт",
        "heatmap_day_sat": "Сб",
        "heatmap_day_sun": "Вс",
    },
    "en": {
        "report_title": "Analytical Report for",
        "generated": "Generated:",
        "current_market": "Current Market (bias):",
        "bullish": "Bullish",
        "bearish": "Bearish",
        "summary_title": "📈 Summary",
        "indicator": "Indicator",
        "value": "Value",
        "interpretation": "Interpretation",
        "current_price": "Current price",
        "moving_direction": "Moving averages direction",
        "avg_volatility": "Average market volatility",
        "user_confirmations": "Selected confirmations (user)",
        "result": "Result:",
        "reliability_rating": "🎯 Signal Reliability Rating",
        "confidence_index": "📊 Confidence Index",
        "very_high_confidence": "Very high confidence",
        "high_confidence": "High confidence",
        "medium_confidence": "Medium confidence",
        "low_confidence": "Low confidence",
        "extreme_fear": "Extreme Fear",
        "fear": "Fear",
        "neutral": "Neutral",
        "greed": "Greed",
        "extreme_greed": "Extreme Greed",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
        "strategy_title": "⚙️ Strategy",
        "trading_type_label": "Trading type:",
        "strategy_label": "Strategy:",
        "capital_label": "Capital:",
        "dynamic_risk": "Dynamic risk:",
        "base_risk": "base",
        "confirmation_type": "Confirmation type:",
        "levels_title": "🎯 Levels",
        "long": "Long",
        "short": "Short",
        "parameter": "Parameter",
        "distance": "Distance",
        "trigger_buy": "Trigger (buy-stop)",
        "trigger_sell": "Trigger (sell-stop)",
        "stop_loss": "Stop Loss",
        "take_profit": "Take Profit",
        "position_size": "Position size",
        "psychological_levels_title": "🎯 Psychological Levels",
        "psychological_levels_desc": "Nearest psychological levels (round numbers) can serve as additional support/resistance levels:",
        "psychological_levels_not_found": "Psychological levels not found",
        "price": "Price",
        "perspective_title": "💰 Perspective",
        "more_perspective": "More promising:",
        "trend": "Trend:",
        "bull_market": "Bull market",
        "bear_market": "Bear market",
        "oversold": "Oversold",
        "overbought": "Overbought",
        "neutral_zone": "Neutral zone",
        "within_bounds": "Within bounds",
        "out_of_bounds": "Out of bounds",
        "upward_momentum": "Upward momentum",
        "downward_momentum": "Downward momentum",
        "strong_trend": "Strong trend",
        "weak_trend": "Weak trend",
        "medium_trend": "Medium trend",
        "recommendations_title": "💡 Additional Recommendations",
        "candlestick_title": "🕯️ Candlestick Analysis",
        "candlestick_desc": "Recognized candlestick patterns in recent candles:",
        "candlestick_not_found": "Candlestick patterns not detected in recent candles",
        "candlestick_interpretation_title": "How to interpret:",
        "candlestick_interpretation_text": "Candlestick analysis is based on Japanese candlestick patterns. Each pattern shows market sentiment: bullish patterns (green) indicate possible growth, bearish (red) — possible decline. Signal strength depends on context and confirmation by other indicators.",
        "btc_comparison_title": "📈 Comparison with BTC/USDT",
        "additional_metrics_title": "📊 Additional Metrics",
        "price_movement_probabilities": "Price movement probabilities:",
        "probability_up_1": "Probability of 1% growth:",
        "probability_up_2": "Probability of 2% growth:",
        "probability_up_5": "Probability of 5% growth:",
        "confidence_interpretation": "Confidence Index interpretation ({confidence}%):",
        "very_high_confidence_desc": "✅ Very high confidence in signal — all components point in one direction",
        "high_confidence_desc": "✅ High confidence — most factors confirm the signal",
        "medium_confidence_desc": "⚠️ Medium confidence — signal partially confirmed, caution required",
        "low_confidence_desc": "❌ Low confidence — weak signal, recommended to refrain from entry",
        "pattern": "Pattern",
        "description": "Description",
        "reliability_warning": "⚠️ **WARNING:** Signal reliability rating ({rating}%) is below the minimum threshold ({min}%). It is recommended to refrain from entry.",
        "no_confirmations": "No confirmations selected",
        # Trading type translations
        "trading_type_scalping": "Scalping",
        "trading_type_daytrading": "Day Trading",
        "trading_type_swing": "Swing",
        "trading_type_medium_term": "Medium-term",
        "trading_type_long_term": "Long-term",
        # Strategy translations
        "strategy_conservative": "Conservative",
        "strategy_balanced": "Balanced",
        "strategy_aggressive": "Aggressive",
        # Recommendation translations
        "rec_market_flat": "Market in flat — better to refrain from entries.",
        "rec_rsi_oversold": "RSI < 30 — oversold, possible bounce up.",
        "rec_rsi_overbought": "RSI > 70 — overbought, possible correction.",
        "rec_ema_bullish": "EMA50 above EMA200 — overall bullish bias, longs preferred.",
        "rec_ema_bearish": "EMA50 below EMA200 — overall bearish bias, consider shorts carefully.",
        "rec_vwma_below": "Price below VWMA — selling pressure intensifies.",
        "rec_vwma_above": "Price above VWMA — upward momentum persists.",
        # Candlestick pattern translations
        "pattern_doji": "Doji - uncertainty, possible reversal",
        "pattern_inverted_hammer": "Inverted Hammer - possible reversal up",
        "pattern_hammer": "Hammer - possible reversal up",
        "pattern_shooting_star": "Shooting Star - possible reversal down",
        "pattern_bullish_engulfing": "Bullish Engulfing - possible reversal up",
        "pattern_bearish_engulfing": "Bearish Engulfing - possible reversal down",
        # Forecast translations
        "forecast_title": "📊 Forecast based on history",
        "forecast_analysis": "Analysis of {cases} similar situations in history:",
        "forecast_success_prob": "🎯 Success probability:",
        "forecast_expected_profit": "💰 Expected profit:",
        "forecast_range": "📊 Range of possible results: from {min}% to {max}%",
        "forecast_note": "*Note: the range shows the minimum and maximum result from similar situations in history*",
        # Additional translations for ML forecast
        "ml_forecast_title": "🤖 ML-forecast probability of success",
        "ml_forecast_analysis": "Analysis based on similar indicator patterns:",
        "ml_forecast_success_prob": "🎯 Probability of success:",
        "ml_forecast_similar_cases": "📊 Similar cases in history:",
        "ml_forecast_confidence": "⚡ Confidence level:",
        # Translations for R:R
        "risk_reward_ratio_title": "📊 Risk:Reward Ratio (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        # Position management translations
        "position_management_title": "=== Position Management ===",
        "position_stop_loss": "Stop Loss:",
        "position_take_profit": "Take Profit:",
        "position_risk_reward": "Risk/Reward:",
        "position_size_label": "Position:",
        "position_explanation": "*Explanation: units — number of asset units ({asset}), ${dollars} — position value in dollars*",
        "historical_volatility": "Historical Volatility",
        "partially_confirmed": "Partially confirmed",
        "backtest_results_title": "Backtest Results",
        "backtest_last_days": "last {days} days",
        "backtest_total_trades": "Total Trades",
        "backtest_winning_trades": "Winning",
        "backtest_losing_trades": "Losing",
        "backtest_win_rate": "Win Rate",
        "backtest_total_profit": "Total Profit",
        "backtest_max_drawdown": "Max Drawdown",
        "backtest_avg_rr": "Avg R:R",
        "backtest_final_capital": "Final Capital",
        "all_confirmations": "All confirmations",
        # Errors and messages
        "error_user_not_found": "User not found",
        "error_invalid_password": "Invalid password",
        "error_unauthorized": "Authorization required",
        "error_unauthorized_short": "Unauthorized",
        "error_no_data": "No data",
        "error_binance_connection": "Failed to connect to Binance API. Check your internet connection.",
        "error_binance_dns": "DNS or network connection error",
        "error_binance_server": "Binance API connection error. Server unavailable.",
        "error_binance_data": "Error getting data: {error}",
        "error_binance_no_data": "Failed to get data from Binance API",
        "error_settings_saved": "Settings saved",
        "error_spread_range": "Spread must be between 0 and 1%",
        "error_trading_settings_saved": "Trading settings saved",
        "error_message_empty": "Message cannot be empty",
        "error_message_sent": "Message sent",
        "error_message_failed": "Failed to send message",
        "error_unknown": "Unknown error",
        "error_insufficient_data": "Insufficient data",
        "error_insufficient_data_atr": "Insufficient data to calculate ATR (minimum 14 rows required)",
        "error_analysis": "Analysis error",
        "error_symbol_not_found": "not found on exchange",
        "error_symbol_not_traded": "This pair may not be traded on Binance.",
        "error_load_data": "Error loading data",
        "no_data_available": "No data available",
        # Notifications
        "notification_new_signal": "New trading signal!",
        "notification_instrument": "Instrument:",
        "notification_direction": "Direction:",
        "notification_trend": "Trend:",
        "notification_strategy": "Strategy:",
        "notification_levels": "Levels:",
        "notification_entry": "Entry:",
        "notification_stop_loss": "Stop Loss:",
        "notification_take_profit": "Take Profit:",
        "notification_rr": "R:R:",
        "notification_reliability": "Reliability:",
        # Statistics
        "stats_successful": "Successful",
        "stats_unsuccessful": "Unsuccessful",
        "stats_distribution_result": "Trade distribution by result",
        "stats_distribution_instruments": "Trade distribution by instruments",
        "long_direction": "Long 🚀",
        "short_direction": "Short 📉",
        "rsi_label": "RSI:",
        "range_label": "Range:",
        "vwma_label": "VWMA:",
        "adx_label": "ADX:",
        "chart_entry": "Entry",
        "chart_stop_loss": "Stop Loss",
        "chart_take_profit": "Take Profit",
        "chart_trailing_stop": "Trailing Stop Loss",
        "indicator_close": "Close",
        "indicator_ema": "EMA20 / EMA50 / EMA200",
        "indicator_rsi": "RSI(14)",
        "indicator_atr": "ATR(14)",
        "indicator_trend": "Trend",
        "indicator_vwma": "VWMA(20)",
        "indicator_adx": "ADX",
        "rr_label": "R:R",
        "ml_forecast_title": "🤖 ML-forecast probability of success",
        "ml_forecast_analysis": "Analysis based on similar indicator patterns:",
        "ml_forecast_success_prob": "🎯 Probability of success:",
        "ml_forecast_similar_cases": "📊 Similar cases in history:",
        "ml_forecast_confidence": "⚡ Confidence level:",
        # Translations for R:R
        "risk_reward_ratio_title": "📊 Risk:Reward Ratio (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        "confidence_high": "High",
        "confidence_medium": "Medium",
        "confidence_low": "Low",
        "perspective_flat": "Market in flat ⚖️",
        "perspective_uncertain": "Trend unclear — forming movement ⚖️",
        "perspective_bullish": "Clear bullish trend 🚀",
        "perspective_bearish": "Clear bearish trend 📉",
        "perspective_mixed": "Trend expressed, but confirmations unclear 🔄",
        # Errors and messages
        "error_user_not_found": "User not found",
        "error_invalid_password": "Invalid password",
        "error_unauthorized": "Authorization required",
        "error_unauthorized_short": "Unauthorized",
        "error_no_data": "No data",
        "error_binance_connection": "Failed to connect to Binance API. Check your internet connection.",
        "error_binance_dns": "DNS or network connection error",
        "error_binance_server": "Binance API connection error. Server unavailable.",
        "error_binance_data": "Error getting data: {error}",
        "error_binance_no_data": "Failed to get data from Binance API",
        "error_settings_saved": "Settings saved",
        "error_spread_range": "Spread must be between 0 and 1%",
        "error_trading_settings_saved": "Trading settings saved",
        "error_message_empty": "Message cannot be empty",
        "error_message_sent": "Message sent",
        "error_message_failed": "Failed to send message",
        "error_unknown": "Unknown error",
        "error_insufficient_data": "Insufficient data",
        "error_insufficient_data_atr": "Insufficient data to calculate ATR (minimum 14 rows required)",
        "error_analysis": "Analysis error",
        "error_symbol_not_found": "not found on exchange",
        "error_symbol_not_traded": "This pair may not be traded on Binance.",
        "error_load_data": "Error loading data",
        "no_data_available": "No data available",
        # Notifications
        "notification_new_signal": "New trading signal!",
        "notification_instrument": "Instrument:",
        "notification_direction": "Direction:",
        "notification_trend": "Trend:",
        "notification_strategy": "Strategy:",
        "notification_levels": "Levels:",
        "notification_entry": "Entry:",
        "notification_stop_loss": "Stop Loss:",
        "notification_take_profit": "Take Profit:",
        "notification_rr": "R:R:",
        "notification_reliability": "Reliability:",
        "notification_time": "Time:",
        # Индикаторы для таблицы
        "indicator_close": "Close",
        "indicator_ema": "EMA20 / EMA50 / EMA200",
        "indicator_rsi": "RSI(14)",
        "indicator_atr": "ATR(14)",
        "indicator_trend": "Trend",
        "indicator_vwma": "VWMA(20)",
        "indicator_adx": "ADX",
        # R:R переводы
        "risk_reward_ratio_title": "📊 Risk:Reward Ratio (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        # Statistics
        "stats_successful": "Successful",
        "stats_unsuccessful": "Unsuccessful",
        "stats_distribution_result": "Trade distribution by result",
        "stats_distribution_instruments": "Trade distribution by instruments",
        # Translations for heatmap graphs
        "heatmap_profit_pct": "Profit (%)",
        "heatmap_by_hour_title": "Profitability by hour of day",
        "heatmap_by_day_title": "Profitability by day of week",
        "heatmap_hour_label": "Hour of day (UTC)",
        "heatmap_day_label": "Day of week",
        "heatmap_instrument_label": "Instrument",
        "heatmap_day_mon": "Mon",
        "heatmap_day_tue": "Tue",
        "heatmap_day_wed": "Wed",
        "heatmap_day_thu": "Thu",
        "heatmap_day_fri": "Fri",
        "heatmap_day_sat": "Sat",
        "heatmap_day_sun": "Sun",
    },
    "uk": {
        "report_title": "Аналітичний звіт по",
        "generated": "Згенеровано:",
        "current_market": "Поточний ринок (bias):",
        "bullish": "Бичий",
        "bearish": "Ведмежий",
        "summary_title": "📈 Коротке резюме",
        "indicator": "Показник",
        "value": "Значення",
        "interpretation": "Інтерпретація",
        "current_price": "Поточна ціна",
        "moving_direction": "Напрямок ковзних",
        "avg_volatility": "Середня волатильність ринку",
        "user_confirmations": "Вибрані підтвердження (користувач)",
        "result": "Результат:",
        "reliability_rating": "🎯 Рейтинг надійності сигналу",
        "confidence_index": "📊 Зведений індекс впевненості",
        "very_high_confidence": "Дуже висока впевненість",
        "high_confidence": "Висока впевненість",
        "medium_confidence": "Середня впевненість",
        "low_confidence": "Низька впевненість",
        "extreme_fear": "Крайній страх",
        "fear": "Страх",
        "neutral": "Нейтрально",
        "greed": "Жадібність",
        "extreme_greed": "Крайня жадібність",
        "high": "Висока",
        "medium": "Середня",
        "low": "Низька",
        "strategy_title": "⚙️ Стратегія",
        "trading_type_label": "Тип торгівлі:",
        "strategy_label": "Стратегія:",
        "capital_label": "Капітал:",
        "dynamic_risk": "Динамічний ризик:",
        "base_risk": "базовий",
        "confirmation_type": "Тип підтвердження:",
        "levels_title": "🎯 Рівні",
        "long": "Лонг",
        "short": "Шорт",
        "parameter": "Параметр",
        "distance": "Відстань",
        "trigger_buy": "Тригер (buy-stop)",
        "trigger_sell": "Тригер (sell-stop)",
        "stop_loss": "Стоп-лосс",
        "take_profit": "Take-profit",
        "position_size": "Розмір позиції",
        "psychological_levels_title": "🎯 Психологічні рівні",
        "psychological_levels_desc": "Найближчі психологічні рівні (круглі числа) можуть служити додатковими рівнями підтримки/опору:",
        "psychological_levels_not_found": "Психологічні рівні не знайдені",
        "price": "Ціна",
        "perspective_title": "💰 Перспектива",
        "more_perspective": "Більш перспективно:",
        "trend": "Тренд:",
        "bull_market": "Бичий ринок",
        "bear_market": "Ведмежий ринок",
        "oversold": "Перепроданість",
        "overbought": "Перекупленість",
        "neutral_zone": "Нейтральна зона",
        "within_bounds": "В межах кордонів",
        "out_of_bounds": "Вихід за межі",
        "upward_momentum": "Висхідний імпульс",
        "downward_momentum": "Низхідний імпульс",
        "strong_trend": "Сильний тренд",
        "weak_trend": "Слабкий тренд",
        "medium_trend": "Середній тренд",
        "recommendations_title": "💡 Додаткові рекомендації",
        "candlestick_title": "🕯️ Свічковий аналіз",
        "candlestick_desc": "Розпізнані свічкові паттерни в останніх свічках:",
        "candlestick_not_found": "Свічкові паттерни не виявлені в останніх свічках",
        "candlestick_interpretation_title": "Як трактувати:",
        "candlestick_interpretation_text": "Свічковий аналіз базується на паттернах японських свічок. Кожен паттерн показує настрій ринку: бичі паттерни (зелені) вказують на можливе зростання, ведмежі (червоні) — на можливе падіння. Сила сигналу залежить від контексту та підтвердження іншими індикаторами.",
        "btc_comparison_title": "📈 Порівняння з BTC/USDT",
        "additional_metrics_title": "📊 Додаткові метрики",
        "price_movement_probabilities": "Ймовірності руху ціни:",
        "probability_up_1": "Ймовірність зростання на 1%:",
        "probability_up_2": "Ймовірність зростання на 2%:",
        "probability_up_5": "Ймовірність зростання на 5%:",
        "confidence_interpretation": "Інтерпретація зведеного індексу впевненості ({confidence}%):",
        "very_high_confidence_desc": "✅ Дуже висока впевненість у сигналі — всі компоненти вказують в одному напрямку",
        "high_confidence_desc": "✅ Висока впевненість — більшість факторів підтверджують сигнал",
        "medium_confidence_desc": "⚠️ Середня впевненість — сигнал підтверджено частково, потрібна обережність",
        "low_confidence_desc": "❌ Низька впевненість — слабкий сигнал, рекомендується утриматися від входу",
        "pattern": "Паттерн",
        "description": "Опис",
        "reliability_warning": "⚠️ **УВАГА:** Рейтинг надійності сигналу ({rating}%) нижче мінімального порогу ({min}%). Рекомендується утриматися від входу.",
        "no_confirmations": "Немає вибраних підтверджень",
        # Переклади для типів торгівлі
        "trading_type_scalping": "Скальпінг",
        "trading_type_daytrading": "Дейтрейдинг",
        "trading_type_swing": "Свінг",
        "trading_type_medium_term": "Середньострокова",
        "trading_type_long_term": "Довгострокова",
        # Переклади для стратегій
        "strategy_conservative": "Консервативна",
        "strategy_balanced": "Збалансована",
        "strategy_aggressive": "Агресивна",
        # Переклади для рекомендацій
        "rec_market_flat": "Ринок у флеті — краще утриматися від входів.",
        "rec_rsi_oversold": "RSI < 30 — перепроданість, можливий відскок вгору.",
        "rec_rsi_overbought": "RSI > 70 — перекупленість, можлива корекція.",
        "rec_ema_bullish": "EMA50 вище EMA200 — загальний фон бичий, лонги переважніші.",
        "rec_ema_bearish": "EMA50 нижче EMA200 — загальний фон ведмежий, розглядати шорти обережно.",
        "rec_vwma_below": "Ціна нижче VWMA — тиск продавців посилюється.",
        "rec_vwma_above": "Ціна вище VWMA — висхідний імпульс зберігається.",
        # Переклади для свічкових паттернів
        "pattern_doji": "Доджі - невизначеність, можливий розворот",
        "pattern_inverted_hammer": "Перевернутий молот - можливий розворот вгору",
        "pattern_hammer": "Молот - можливий розворот вгору",
        "pattern_shooting_star": "Падаюча зірка - можливий розворот вниз",
        "pattern_bullish_engulfing": "Биче поглинання - можливий розворот вгору",
        "pattern_bearish_engulfing": "Ведмеже поглинання - можливий розворот вниз",
        # Переклади для прогнозу
        "forecast_title": "📊 Прогноз на основі історії",
        "forecast_analysis": "Аналіз {cases} подібних ситуацій в історії:",
        "forecast_success_prob": "🎯 Ймовірність успіху:",
        "forecast_expected_profit": "💰 Очікуваний прибуток:",
        "forecast_range": "📊 Діапазон можливих результатів: від {min}% до {max}%",
        "forecast_note": "*Примітка: діапазон показує мінімальний і максимальний результат з подібних ситуацій в історії*",
        # Додаткові переклади для ML прогнозу
        "ml_forecast_title": "🤖 ML-прогноз ймовірності успіху",
        "ml_forecast_analysis": "Аналіз на основі подібних паттернів індикаторів:",
        "ml_forecast_success_prob": "🎯 Ймовірність успіху:",
        "ml_forecast_similar_cases": "📊 Подібних випадків в історії:",
        "ml_forecast_confidence": "⚡ Рівень впевненості:",
        # Переклади для управління позицією
        "position_management_title": "=== Управління позицією ===",
        "position_stop_loss": "Stop Loss:",
        "position_take_profit": "Take Profit:",
        "position_risk_reward": "Risk/Reward:",
        "position_size_label": "Position:",
        "position_explanation": "*Пояснення: units — кількість одиниць активу ({asset}), ${dollars} — вартість позиції в доларах*",
        "historical_volatility": "Історична волатильність",
        "partially_confirmed": "Частково підтверджено",
        "backtest_results_title": "Результати бектесту",
        "backtest_last_days": "останні {days} днів",
        "backtest_total_trades": "Всього угод",
        "backtest_winning_trades": "Прибуткових",
        "backtest_losing_trades": "Збиткових",
        "backtest_win_rate": "Win Rate",
        "backtest_total_profit": "Загальний прибуток",
        "backtest_max_drawdown": "Максимальна просадка",
        "backtest_avg_rr": "Середній R:R",
        "backtest_final_capital": "Фінальний капітал",
        "all_confirmations": "Всі підтвердження",
        # Помилки API
        "error_user_not_found": "Користувач не знайдений",
        "error_invalid_password": "Невірний пароль",
        "error_unauthorized": "Потрібна авторизація",
        "error_unauthorized_short": "Неавторизований",
        "error_no_data": "Немає даних",
        "error_binance_connection": "Не вдалося підключитися до Binance API. Перевірте інтернет-з'єднання.",
        "error_binance_dns": "Помилка DNS або мережевого підключення",
        "error_binance_server": "Помилка підключення до Binance API. Сервер недоступний.",
        "error_binance_data": "Помилка отримання даних: {error}",
        "error_binance_no_data": "Не вдалося отримати дані від Binance API",
        "error_settings_saved": "Налаштування збережено",
        "error_spread_range": "Спред повинен бути від 0 до 1%",
        "error_trading_settings_saved": "Налаштування торгівлі збережено",
        "error_message_empty": "Повідомлення не може бути порожнім",
        "error_message_sent": "Повідомлення відправлено",
        "error_message_failed": "Не вдалося відправити повідомлення",
        "error_unknown": "Невідома помилка",
        "error_insufficient_data": "Недостатньо даних",
        "error_insufficient_atr_data": "Недостатньо даних для розрахунку ATR (потрібно мінімум 14 рядків)",
        "error_analysis_failed": "Помилка аналізу",
        # Сповіщення
        "notification_new_signal": "Новий торговий сигнал!",
        "notification_instrument": "Інструмент:",
        "notification_direction": "Напрямок:",
        "notification_trend": "Тренд:",
        "notification_strategy": "Стратегія:",
        "notification_levels": "Рівні:",
        "notification_entry_price": "Вхід:",
        "notification_stop_loss_price": "Stop Loss:",
        "notification_take_profit_price": "Take Profit:",
        "notification_rr_ratio": "R:R:",
        "notification_reliability_rating": "Надійність:",
        # Графіки
        "chart_successful_trades": "Успішні",
        "chart_unsuccessful_trades": "Неуспішні",
        "chart_trades_distribution": "Розподіл угод за результатом",
        "chart_trades_by_instrument": "Розподіл угод за інструментами",
        # Повідомлення для користувача
        "error_load_data": "Помилка завантаження даних",
        "error_symbol_not_found": "не знайдена на біржі",
        "error_symbol_not_traded": "Можливо, ця пара не торгується на Binance.",
        "no_data_available": "Немає даних для відображення",
        "long_direction": "Лонг 🚀",
        "short_direction": "Шорт 📉",
        "rsi_label": "RSI:",
        "range_label": "Діапазон:",
        "vwma_label": "VWMA:",
        "adx_label": "ADX:",
        "chart_entry": "Вхід",
        "chart_stop_loss": "Стоп-лосс",
        "chart_take_profit": "Take Profit",
        "chart_trailing_stop": "Трейлінг стоп-лосс",
        "indicator_close": "Close",
        "indicator_ema": "EMA20 / EMA50 / EMA200",
        "indicator_rsi": "RSI(14)",
        "indicator_atr": "ATR(14)",
        "indicator_trend": "Trend",
        "indicator_vwma": "VWMA(20)",
        "indicator_adx": "ADX",
        "rr_label": "R:R",
        "ml_forecast_title": "🤖 ML-прогноз ймовірності успіху",
        "ml_forecast_analysis": "Аналіз на основі подібних паттернів індикаторів:",
        "ml_forecast_success_prob": "🎯 Ймовірність успіху:",
        "ml_forecast_similar_cases": "📊 Подібних випадків в історії:",
        "ml_forecast_confidence": "⚡ Рівень впевненості:",
        "confidence_high": "Високий",
        "confidence_medium": "Середній",
        "confidence_low": "Низький",
        "perspective_flat": "Ринок у флеті ⚖️",
        "perspective_uncertain": "Тренд невизначений — формується рух ⚖️",
        "perspective_bullish": "Явний бичий тренд 🚀",
        "perspective_bearish": "Явний ведмежий тренд 📉",
        "perspective_mixed": "Тренд виражений, але підтвердження неоднозначні 🔄",
        # Переклади для R:R
        "risk_reward_ratio_title": "📊 Співвідношення Ризик:Прибуток (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        # Помилки та повідомлення
        "error_user_not_found": "Користувача не знайдено",
        "error_invalid_password": "Невірний пароль",
        "error_unauthorized": "Потрібна авторизація",
        "error_unauthorized_short": "Неавторизовано",
        "error_no_data": "Немає даних",
        "error_binance_connection": "Не вдалося підключитися до Binance API. Перевірте інтернет-з'єднання.",
        "error_binance_dns": "Помилка DNS або мережевого підключення",
        "error_binance_server": "Помилка підключення до Binance API. Сервер недоступний.",
        "error_binance_data": "Помилка отримання даних: {error}",
        "error_binance_no_data": "Не вдалося отримати дані від Binance API",
        "error_settings_saved": "Налаштування збережено",
        "error_spread_range": "Спред має бути від 0 до 1%",
        "error_trading_settings_saved": "Налаштування торгівлі збережено",
        "error_message_empty": "Повідомлення не може бути порожнім",
        "error_message_sent": "Повідомлення відправлено",
        "error_message_failed": "Не вдалося відправити повідомлення",
        "error_unknown": "Невідома помилка",
        "error_insufficient_data": "Недостатньо даних",
        "error_insufficient_data_atr": "Недостатньо даних для розрахунку ATR (потрібно мінімум 14 рядків)",
        "error_analysis": "Помилка аналізу",
        "error_symbol_not_found": "не знайдена на біржі",
        "error_symbol_not_traded": "Можливо, ця пара не торгується на Binance.",
        "error_load_data": "Помилка завантаження даних",
        "no_data_available": "Немає даних для відображення",
        # Сповіщення
        "notification_new_signal": "Новий торговий сигнал!",
        "notification_instrument": "Інструмент:",
        "notification_direction": "Напрямок:",
        "notification_trend": "Тренд:",
        "notification_strategy": "Стратегія:",
        "notification_levels": "Рівні:",
        "notification_entry": "Вхід:",
        "notification_stop_loss": "Стоп-лосс:",
        "notification_take_profit": "Take Profit:",
        "notification_rr": "R:R:",
        "notification_reliability": "Надійність:",
        "notification_time": "Час:",
        # Індикатори для таблиці
        "indicator_close": "Close",
        "indicator_ema": "EMA20 / EMA50 / EMA200",
        "indicator_rsi": "RSI(14)",
        "indicator_atr": "ATR(14)",
        "indicator_trend": "Trend",
        "indicator_vwma": "VWMA(20)",
        "indicator_adx": "ADX",
        # R:R переклади
        "risk_reward_ratio_title": "📊 Співвідношення Ризик:Прибуток (R:R)",
        "risk_reward_long": "Long:",
        "risk_reward_short": "Short:",
        # Статистика
        "stats_successful": "Успішні",
        "stats_unsuccessful": "Неуспішні",
        "stats_distribution_result": "Розподіл угод за результатом",
        "stats_distribution_instruments": "Розподіл угод за інструментами",
        # Переклади для heatmap графіків
        "heatmap_profit_pct": "Прибуток (%)",
        "heatmap_by_hour_title": "Прибутковість за годинами дня",
        "heatmap_by_day_title": "Прибутковість за днями тижня",
        "heatmap_hour_label": "Година дня (UTC)",
        "heatmap_day_label": "День тижня",
        "heatmap_instrument_label": "Інструмент",
        "heatmap_day_mon": "Пн",
        "heatmap_day_tue": "Вт",
        "heatmap_day_wed": "Ср",
        "heatmap_day_thu": "Чт",
        "heatmap_day_fri": "Пт",
        "heatmap_day_sat": "Сб",
        "heatmap_day_sun": "Нд",
        # Переклади для типів торгівлі
        "trading_type_scalping": "Скальпінг",
        "trading_type_daytrading": "Дейтрейдинг",
        "trading_type_swing": "Свінг",
        "trading_type_medium_term": "Середньострокова",
        "trading_type_long_term": "Довгострокова",
        # Переклади для стратегій
        "strategy_conservative": "Консервативна",
        "strategy_balanced": "Збалансована",
        "strategy_aggressive": "Агресивна",
        # Переклади для рекомендацій
        "rec_market_flat": "Ринок у флеті — краще утриматися від входів.",
        "rec_rsi_oversold": "RSI < 30 — перепроданість, можливий відскок вгору.",
        "rec_rsi_overbought": "RSI > 70 — перекупленість, можлива корекція.",
        "rec_ema_bullish": "EMA50 вище EMA200 — загальний фон бичий, лонги переважніші.",
        "rec_ema_bearish": "EMA50 нижче EMA200 — загальний фон ведмежий, розглядати шорти обережно.",
        "rec_vwma_below": "Ціна нижче VWMA — тиск продавців посилюється.",
        "rec_vwma_above": "Ціна вище VWMA — висхідний імпульс зберігається.",
        # Переклади для свічкових паттернів
        "pattern_doji": "Доджі - невизначеність, можливий розворот",
        "pattern_inverted_hammer": "Перевернутий молот - можливий розворот вгору",
        "pattern_hammer": "Молот - можливий розворот вгору",
        "pattern_shooting_star": "Падаюча зірка - можливий розворот вниз",
        "pattern_bullish_engulfing": "Биче поглинання - можливий розворот вгору",
        "pattern_bearish_engulfing": "Ведмеже поглинання - можливий розворот вниз",
        # Переклади для прогнозу
        "forecast_title": "📊 Прогноз на основі історії",
        "forecast_analysis": "Аналіз {cases} подібних ситуацій в історії:",
        "forecast_success_prob": "🎯 Ймовірність успіху:",
        "forecast_expected_profit": "💰 Очікуваний прибуток:",
        "forecast_range": "📊 Діапазон можливих результатів: від {min}% до {max}%",
        "forecast_note": "*Примітка: діапазон показує мінімальний і максимальний результат з подібних ситуацій в історії*",
        # Переклади для управління позицією
        "position_management_title": "=== Управління позицією ===",
        "position_stop_loss": "Stop Loss:",
        "position_take_profit": "Take Profit:",
        "position_risk_reward": "Risk/Reward:",
        "position_size_label": "Position:",
        "position_explanation": "*Пояснення: units — кількість одиниць активу ({asset}), ${dollars} — вартість позиції в доларах*",
        "no_confirmations": "Немає вибраних підтверджень",
        "btc_return": "Доходність BTC/USDT (Buy & Hold)",
        "strategy_return": "Потенційна доходність стратегії",
        "alpha": "Alpha (перевищення)",
        "result": "Результат",
        "strategy_better": "Стратегія краще",
        "btc_better": "BTC/USDT краще",
        "equal": "Рівні",
        "btc_unavailable": "Порівняння з BTC/USDT недоступне (недостатньо даних)",
    }
}

# Дополнительные переводы для сравнения с BTC
BTC_COMPARISON_TRANSLATIONS = {
    "ru": {
        "btc_return": "Доходность BTC/USDT (Buy & Hold)",
        "strategy_return": "Потенциальная доходность стратегии",
        "alpha": "Alpha (превышение)",
        "result": "Результат",
        "strategy_better": "Стратегия лучше",
        "btc_better": "BTC/USDT лучше",
        "equal": "Равны",
        "btc_unavailable": "Сравнение с BTC/USDT недоступно (недостаточно данных)",
    },
    "en": {
        "btc_return": "BTC/USDT Return (Buy & Hold)",
        "strategy_return": "Potential Strategy Return",
        "alpha": "Alpha (excess)",
        "result": "Result",
        "strategy_better": "Strategy better",
        "btc_better": "BTC/USDT better",
        "equal": "Equal",
        "btc_unavailable": "Comparison with BTC/USDT unavailable (insufficient data)",
    },
    "uk": {
        "btc_return": "Доходність BTC/USDT (Buy & Hold)",
        "strategy_return": "Потенційна доходність стратегії",
        "alpha": "Alpha (перевищення)",
        "result": "Результат",
        "strategy_better": "Стратегія краще",
        "btc_better": "BTC/USDT краще",
        "equal": "Рівні",
        "btc_unavailable": "Порівняння з BTC/USDT недоступне (недостатньо даних)",
    }
}

def get_report_translation(key, language="ru", default=None, **params):
    """Получить перевод для отчета"""
    lang = language if language in REPORT_TRANSLATIONS else "ru"
    translation = REPORT_TRANSLATIONS[lang].get(key, REPORT_TRANSLATIONS["ru"].get(key, default if default else key))
    if params:
        try:
            return translation.format(**params)
        except:
            return translation
    return translation

def translate_markdown(md, language="ru"):
    """Заменяет все ключи {key} и {{key}} на переводы из REPORT_TRANSLATIONS
    
    Гарантирует 100% замену всех ключей на сервере перед отправкой на клиент.
    Обрабатывает вложенные ключи через множественные проходы.
    Поддерживает оба формата: {{key}} (двойные скобки) и {key} (одинарные - после f-строк).
    """
    if not md:
        return md
    
    import re
    lang = language if language in REPORT_TRANSLATIONS else "ru"
    translations = REPORT_TRANSLATIONS[lang]
    
    # Создаем набор всех ключей переводов для проверки
    all_keys = set()
    for lang_code in ["ru", "en", "uk"]:
        if lang_code in REPORT_TRANSLATIONS:
            all_keys.update(REPORT_TRANSLATIONS[lang_code].keys())
    
    # Заменяем все ключи на переводы (ключи могут содержать буквы, цифры и подчеркивания)
    # Делаем несколько проходов для обработки вложенных ключей
    result = md
    max_iterations = 10  # Максимум итераций для обработки вложенных ключей
    iteration = 0
    
    while iteration < max_iterations:
        prev_result = result
        
        # Сортируем ключи по длине (от больших к меньшим) чтобы избежать частичных замен
        sorted_keys = sorted(all_keys, key=len, reverse=True)
        
        # Сначала заменяем двойные скобки {{key}}
        for key in sorted_keys:
            pattern = r'\{\{' + re.escape(key) + r'\}\}'
            if re.search(pattern, result):
                translation = translations.get(key, REPORT_TRANSLATIONS["ru"].get(key, key))
                result = re.sub(pattern, translation, result)
        
        # Затем заменяем одинарные скобки {key}, но только если это ключ перевода
        for key in sorted_keys:
            pattern = r'\{' + re.escape(key) + r'\}'
            if re.search(pattern, result):
                translation = translations.get(key, REPORT_TRANSLATIONS["ru"].get(key, key))
                result = re.sub(pattern, translation, result)
        
        # Если ничего не изменилось, значит все ключи заменены
        if result == prev_result:
            break
        iteration += 1
    
    return result

# === вспомогательные функции ===
def safe_fmt(x):
    try:
        return f"{float(x):,.2f}"
    except:
        return "N/A"

def compare_with_btc(symbol, timeframe, strategy_return, df, capital=10000):
    """
    Сравнивает доходность стратегии с BTC/USDT за тот же период.
    
    Параметры:
    - symbol: символ торговой пары (например, "ETH/USDT")
    - timeframe: таймфрейм данных
    - strategy_return: доходность стратегии в процентах
    - df: DataFrame с данными текущей пары
    - capital: начальный капитал
    
    Возвращает:
    - словарь с результатами сравнения: {"btc_return": float, "alpha": float, "better": str}
    """
    try:
        # Получаем данные BTC/USDT за тот же период
        if len(df) < 2:
            return None
        
        # Определяем период из текущего DataFrame
        start_date = df.index[0]
        end_date = df.index[-1]
        
        # Вычисляем количество дней для загрузки данных BTC
        days_diff = (end_date - start_date).days
        if days_diff < 1:
            days_diff = 30  # Минимум 30 дней
        history_days = min(days_diff + 10, 365)  # Добавляем запас
        
        # Загружаем данные BTC/USDT
        btc_df = fetch_ohlcv("BTC/USDT", timeframe, history_days=history_days)
        if btc_df is None or btc_df.empty:
            return None
        
        # Фильтруем данные BTC за тот же период
        btc_df = btc_df[(btc_df.index >= start_date) & (btc_df.index <= end_date)]
        if len(btc_df) < 2:
            return None
        
        # Рассчитываем доходность BTC (Buy & Hold)
        btc_start_price = btc_df.iloc[0]["Close"]
        btc_end_price = btc_df.iloc[-1]["Close"]
        btc_return = ((btc_end_price - btc_start_price) / btc_start_price) * 100
        
        # Alpha = доходность стратегии - доходность BTC
        alpha = strategy_return - btc_return
        
        # Определяем, что лучше
        better = "strategy" if alpha > 0 else "btc" if alpha < 0 else "equal"
        
        return {
            "btc_return": round(btc_return, 2),
            "alpha": round(alpha, 2),
            "better": better,
            "btc_start_price": round(btc_start_price, 2),
            "btc_end_price": round(btc_end_price, 2)
        }
    except Exception as e:
        print(f"⚠️ Ошибка сравнения с BTC: {e}")
        traceback.print_exc()
        return None

def detect_candlestick_patterns(df, lookback=5):
    """
    Распознает свечные паттерны в последних свечах.
    
    Анализирует последние свечи на наличие классических свечных паттернов:
    - Hammer (Молот) - бычий паттерн, возможен разворот вверх
    - Inverted Hammer (Перевернутый молот) - бычий паттерн
    - Shooting Star (Падающая звезда) - медвежий паттерн, возможен разворот вниз
    - Doji (Доджи) - неопределенность, возможен разворот
    - Bullish Engulfing (Бычье поглощение) - бычий паттерн
    - Bearish Engulfing (Медвежье поглощение) - медвежий паттерн
    
    Паттерны определяются на основе соотношения тела свечи, верхней и нижней тени.
    Эти паттерны показывают настроение рынка и могут служить дополнительными сигналами
    для подтверждения торговых решений в сочетании с другими индикаторами.
    
    Параметры:
    - df: DataFrame с OHLCV данными
    - lookback: количество последних свечей для анализа (по умолчанию 5)
    
    Возвращает:
    - список словарей с паттернами: [{"pattern": "Hammer", "signal": "bullish", "bar": index, "description": "..."}, ...]
    """
    if len(df) < lookback + 1:
        return []
    
    patterns = []
    latest = df.iloc[-lookback:].copy()
    
    for i in range(len(latest) - 1):
        row = latest.iloc[i]
        prev_row = latest.iloc[i - 1] if i > 0 else None
        
        open_price = row["Open"]
        close_price = row["Close"]
        high_price = row["High"]
        low_price = row["Low"]
        
        body = abs(close_price - open_price)
        upper_shadow = high_price - max(open_price, close_price)
        lower_shadow = min(open_price, close_price) - low_price
        total_range = high_price - low_price
        
        if total_range == 0:
            continue
        
        body_ratio = body / total_range
        upper_shadow_ratio = upper_shadow / total_range
        lower_shadow_ratio = lower_shadow / total_range
        
        # Hammer (молот) - длинная нижняя тень, маленькое тело
        if lower_shadow_ratio > 0.6 and body_ratio < 0.3 and upper_shadow_ratio < 0.1:
            patterns.append({
                "pattern": "Hammer",
                "signal": "bullish",
                "bar": len(df) - lookback + i,
                "description": "Молот - возможен разворот вверх"
            })
        
        # Inverted Hammer (перевернутый молот)
        if upper_shadow_ratio > 0.6 and body_ratio < 0.3 and lower_shadow_ratio < 0.1:
            patterns.append({
                "pattern": "Inverted Hammer",
                "signal": "bullish",
                "bar": len(df) - lookback + i,
                "description": "Перевернутый молот - возможен разворот вверх"
            })
        
        # Doji (доджи) - очень маленькое тело
        if body_ratio < 0.1:
            patterns.append({
                "pattern": "Doji",
                "signal": "neutral",
                "bar": len(df) - lookback + i,
                "description": "Доджи - неопределенность, возможен разворот"
            })
        
        # Engulfing (поглощение)
        if prev_row is not None:
            prev_open = prev_row["Open"]
            prev_close = prev_row["Close"]
            prev_body = abs(prev_close - prev_open)
            
            # Бычье поглощение
            if prev_close < prev_open and close_price > open_price:
                if open_price < prev_close and close_price > prev_open and body > prev_body * 1.1:
                    patterns.append({
                        "pattern": "Bullish Engulfing",
                        "signal": "bullish",
                        "bar": len(df) - lookback + i,
                        "description": "Бычье поглощение - сильный сигнал на рост"
                    })
            
            # Медвежье поглощение
            if prev_close > prev_open and close_price < open_price:
                if open_price > prev_close and close_price < prev_open and body > prev_body * 1.1:
                    patterns.append({
                        "pattern": "Bearish Engulfing",
                        "signal": "bearish",
                        "bar": len(df) - lookback + i,
                        "description": "Медвежье поглощение - сильный сигнал на падение"
                    })
        
        # Shooting Star (падающая звезда) - длинная верхняя тень, маленькое тело внизу
        if upper_shadow_ratio > 0.6 and body_ratio < 0.3 and lower_shadow_ratio < 0.1 and close_price < open_price:
            patterns.append({
                "pattern": "Shooting Star",
                "signal": "bearish",
                "bar": len(df) - lookback + i,
                "description": "Падающая звезда - возможен разворот вниз"
            })
    
    return patterns

def find_psychological_levels(price, count=5):
    """
    Находит ближайшие психологические уровни (круглые числа) для заданной цены.
    
    Параметры:
    - price: текущая цена
    - count: количество уровней выше и ниже (всего будет count*2+1)
    
    Возвращает:
    - список уровней (отсортированный по близости к цене)
    """
    if price <= 0:
        return []
    
    # Определяем порядок величины (10^n)
    import math
    order = math.floor(math.log10(price))
    base = 10 ** order
    
    # Генерируем уровни на основе порядка величины
    levels = []
    
    # Для цен > 1000: уровни кратны 1000, 5000, 10000 и т.д.
    if price >= 1000:
        # Уровни: 1000, 2000, 3000, ..., 10000, 20000, ...
        step = base if base >= 1000 else base * 10
        center = math.floor(price / step) * step
        for i in range(-count, count + 1):
            level = center + i * step
            if level > 0:
                levels.append(level)
    elif price >= 100:
        # Уровни: 100, 200, 300, ..., 1000
        step = 100
        center = math.floor(price / step) * step
        for i in range(-count, count + 1):
            level = center + i * step
            if level > 0:
                levels.append(level)
    elif price >= 10:
        # Уровни: 10, 20, 30, ..., 100
        step = 10
        center = math.floor(price / step) * step
        for i in range(-count, count + 1):
            level = center + i * step
            if level > 0:
                levels.append(level)
    elif price >= 1:
        # Уровни: 1, 2, 3, ..., 10
        step = 1
        center = math.floor(price / step) * step
        for i in range(-count, count + 1):
            level = center + i * step
            if level > 0:
                levels.append(level)
    else:
        # Для цен < 1: уровни кратны 0.1, 0.5, 1.0
        if price >= 0.1:
            step = 0.1
        elif price >= 0.01:
            step = 0.01
        else:
            step = 0.001
        center = math.floor(price / step) * step
        for i in range(-count, count + 1):
            level = center + i * step
            if level > 0:
                levels.append(level)
    
    # Убираем дубликаты и сортируем по близости к цене
    levels = sorted(set(levels), key=lambda x: abs(x - price))
    
    # Возвращаем ближайшие уровни (включая текущую цену)
    return levels[:count * 2 + 1]

def get_fear_greed_index():
    """Получает Fear & Greed Index из API. Возвращает: (value: int 0-100, classification: str) или None"""
    try:
        response = requests.get("https://api.alternative.me/fng/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if "data" in data and len(data["data"]) > 0:
                latest = data["data"][0]
                value = int(latest.get("value", 50))
                classification = latest.get("value_classification", "Neutral")
                return value, classification
    except Exception as e:
        print(f"⚠️ Ошибка получения Fear & Greed Index: {e}")
    return None

def calculate_volatility_probabilities(df, timeframe="1d", trend=None, target_moves=[0.01, 0.02, 0.05]):
    """
    Рассчитывает вероятности движения цены на заданные проценты.
    
    Использует логнормальное распределение доходностей с нормализацией волатильности
    до соответствующего timeframe и учетом тренда.
    
    Параметры:
    - df: DataFrame с историческими данными
    - timeframe: таймфрейм данных (например, "1h", "1d", "4h")
    - trend: направление тренда ("Uptrend" или "Downtrend") для корректировки дрифта
    - target_moves: список целевых движений в долях (0.01 = 1%)
    
    Возвращает:
    - словарь {move: probability_in_percent}
    """
    if len(df) < 20:
        return {move: 0.0 for move in target_moves}
    
    latest = df.iloc[-1]
    # Получаем годовую волатильность (в долях, не в процентах)
    volatility_annual = latest.get("Historical_Volatility", 0) / 100
    
    # Защита от edge cases: если волатильность слишком мала или отсутствует
    if volatility_annual <= 1e-6:
        return {move: 50.0 for move in target_moves}  # Нейтральная вероятность
    
    # Нормализуем годовую волатильность до timeframe
    timeframe_to_periods = {
        "1m": 252 * 24 * 60,    # минут в торговом году
        "3m": 252 * 24 * 20,    # 3-минутных свечей
        "5m": 252 * 24 * 12,    # 5-минутных свечей
        "15m": 252 * 24 * 4,    # 15-минутных свечей
        "30m": 252 * 24 * 2,    # 30-минутных свечей
        "1h": 252 * 24,          # часов в торговом году
        "2h": 252 * 12,
        "4h": 252 * 6,
        "6h": 252 * 4,
        "8h": 252 * 3,
        "12h": 252 * 2,
        "1d": 252,                # торговых дней в году
        "3d": 252 / 3,
        "1w": 52,                 # недель в году
        "1M": 12                  # месяцев в году
    }
    
    periods_per_year = timeframe_to_periods.get(timeframe, 252)
    
    # Нормализуем волатильность: σ_timeframe = σ_annual / √(periods_per_year)
    volatility_timeframe = volatility_annual / np.sqrt(periods_per_year)
    
    # Учитываем тренд: добавляем небольшой дрифт
    # Для восходящего тренда вероятность роста выше, для нисходящего - ниже
    if trend == "Uptrend":
        trend_bias = 0.0001  # Небольшой положительный дрифт (0.01% за период)
    elif trend == "Downtrend":
        trend_bias = -0.0001  # Небольшой отрицательный дрифт
    else:
        trend_bias = 0.0  # Нейтральное ожидание
    
    probabilities = {}
    for move in target_moves:
        # Используем логнормальное распределение для доходностей
        # log(1 + move) - логарифм доходности
        log_return = np.log(1 + move)
        
        # Для одного периода (t=1): вероятность = 1 - Φ((log(1+x) - μ) / σ)
        # где μ = trend_bias (дрифт), σ = volatility_timeframe
        z_score = (log_return - trend_bias) / volatility_timeframe
        
        # Вероятность роста на move (в процентах)
        prob_up = (1 - norm.cdf(z_score)) * 100
        
        # Проверка на реалистичность результатов
        prob_up = max(0.1, min(99.9, prob_up))
        
        probabilities[move] = prob_up
    
    return probabilities

def calculate_confidence_index(reliability_rating, fear_greed_value=None, volatility_index=None, 
                                order_book_imbalance=None, correlation_strength=None):
    """
    Рассчитывает сводный индекс уверенности (0-100%).
    
    ✅ ИСПРАВЛЕНО: Убран двойной учёт reliability_rating.
    Теперь reliability_rating учитывается только один раз через indicator_weight.
    """
    fg_normalized = fear_greed_value if fear_greed_value is not None else 50
    vol_normalized = volatility_index if volatility_index is not None else 50
    
    # Базовые компоненты (без reliability_rating, чтобы избежать двойного учёта)
    base_components = {
        "fear_greed": fg_normalized * 0.05,
        "volatility": vol_normalized * 0.05,
    }
    
    has_orderbook = order_book_imbalance is not None
    has_correlation = correlation_strength is not None
    
    if has_orderbook and has_correlation:
        base_components["orderbook"] = order_book_imbalance * 0.1
        base_components["correlation"] = correlation_strength * 0.1
        indicator_weight = 0.7  # Увеличено с 0.4, т.к. reliability теперь единственный источник
    elif has_orderbook:
        base_components["orderbook"] = order_book_imbalance * 0.1
        indicator_weight = 0.75  # Увеличено с 0.5
    elif has_correlation:
        base_components["correlation"] = correlation_strength * 0.1
        indicator_weight = 0.75  # Увеличено с 0.5
    else:
        indicator_weight = 0.8  # Увеличено с 0.6, т.к. reliability теперь основной компонент
    
    # ✅ reliability_rating учитывается только один раз через indicator_weight
    indicator_rating = reliability_rating * indicator_weight
    confidence_index = sum(base_components.values()) + indicator_rating
    return max(0, min(100, confidence_index))

def fetch_ohlcv(symbol, timeframe, history_days=30):
    if not timeframe:
        timeframe = '1h'  # Значение по умолчанию
    
    since_dt = datetime.utcnow() - timedelta(days=history_days)
    since_ms = int(since_dt.timestamp() * 1000)
    all_bars = []
    now_ms = int(datetime.utcnow().timestamp() * 1000)

    while True:
        try:
            # Исправляем вызов API - передаем timeframe как позиционный аргумент
            chunk = exchange.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=1000)
        except Exception as e:
            error_msg = str(e)
            print(f"⚠️ Ошибка fetch_ohlcv для {symbol} с timeframe {timeframe}:", error_msg)
            # Проверяем тип ошибки и предоставляем более понятное сообщение
            if "getaddrinfo failed" in error_msg or "Failed to resolve" in error_msg:
                raise ConnectionError(f"Не удалось подключиться к Binance API. Проверьте интернет-соединение. ({error_msg})")
            elif "NetworkError" in error_msg or "ConnectionError" in error_msg:
                raise ConnectionError(f"Ошибка подключения к Binance API. Сервер недоступен. ({error_msg})")
            else:
                raise
        if not chunk:
            break
        all_bars.extend(chunk)
        since_ms = chunk[-1][0] + 1
        if len(chunk) < 1000 or since_ms >= now_ms:
            break

    if not all_bars:
        return pd.DataFrame()

    df = pd.DataFrame(all_bars, columns=["ts", "Open", "High", "Low", "Close", "Volume"])
    df["Datetime_UTC"] = pd.to_datetime(df["ts"], unit="ms", utc=True)
    df["Datetime_local"] = df["Datetime_UTC"].dt.tz_convert(LOCAL_TZ)
    df = df.set_index("Datetime_local")[["Open", "High", "Low", "Close", "Volume"]].astype(float)
    if timeframe in ("1d", "1w"):
        df = df[df.index.date < datetime.now(LOCAL_TZ).date()]
    return df

def add_indicators(df):
    df = df.copy()
    df["EMA_20"] = df["Close"].ewm(span=20).mean()
    df["EMA_50"] = df["Close"].ewm(span=50).mean()
    df["EMA_200"] = df["Close"].ewm(span=200).mean()

    delta = df["Close"].diff()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    rs = up.rolling(14).mean() / down.rolling(14).mean()
    df["RSI_14"] = 100 - (100 / (1 + rs))

    ema12 = df["Close"].ewm(span=12).mean()
    ema26 = df["Close"].ewm(span=26).mean()
    df["MACD"] = ema12 - ema26
    df["Signal_Line"] = df["MACD"].ewm(span=9).mean()

    hl = df["High"] - df["Low"]
    hc = (df["High"] - df["Close"].shift()).abs()
    lc = (df["Low"] - df["Close"].shift()).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    df["ATR_14"] = tr.rolling(14).mean()

    df["Trend"] = np.where(df["EMA_50"] > df["EMA_200"], "Uptrend", "Downtrend")
    
    # === Расширение волатильности (Фаза 1) ===
    # Историческая волатильность (стандартное отклонение доходности)
    # Используем более длинное окно (50 периодов вместо 20) для стабильности
    returns = df["Close"].pct_change()
    df["Historical_Volatility"] = returns.rolling(window=50).std() * np.sqrt(252) * 100  # Годовая волатильность в %
    
    # Нормализованная волатильность (0-100%) для сводного индекса
    if len(df) > 0:
        vol_max = df["Historical_Volatility"].rolling(window=252).max().iloc[-1] if len(df) >= 252 else df["Historical_Volatility"].max()
        vol_min = df["Historical_Volatility"].rolling(window=252).min().iloc[-1] if len(df) >= 252 else df["Historical_Volatility"].min()
        if vol_max > vol_min:
            df["Volatility_Index"] = ((df["Historical_Volatility"] - vol_min) / (vol_max - vol_min) * 100).clip(0, 100)
        else:
            df["Volatility_Index"] = 50.0  # Нейтральное значение
    else:
        df["Volatility_Index"] = 50.0
    
    return df

def compute_adx(df, period=14):
    try:
        df2 = df.copy()
        up_move = df2['High'].diff()
        down_move = -df2['Low'].diff()
        plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0), index=df2.index)
        minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0), index=df2.index)

        tr = pd.concat([df2['High'] - df2['Low'],
                        (df2['High'] - df2['Close'].shift()).abs(),
                        (df2['Low'] - df2['Close'].shift()).abs()], axis=1).max(axis=1)

        atr = tr.rolling(period).mean()
        plus_di = 100 * (plus_dm.rolling(period).sum() / (atr.replace(0, np.nan)))
        minus_di = 100 * (minus_dm.rolling(period).sum() / (atr.replace(0, np.nan)))
        dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan))
        adx = dx.rolling(period).mean()
        return adx.fillna(0)
    except Exception:
        print("⚠️ compute_adx failed:", traceback.format_exc())
        return pd.Series(0, index=df.index)

def dynamic_risk(risk_pct, rsi, trend, adx=None, reliability_rating=None):
    """
    Динамически корректирует риск на основе рыночных условий.
    
    Параметры:
    - risk_pct: базовый риск (%)
    - rsi: индекс относительной силы
    - trend: направление тренда ("Uptrend" или "Downtrend")
    - adx: индекс направленного движения (опционально, для увеличения риска)
    - reliability_rating: рейтинг надёжности сигнала (опционально, для увеличения риска)
    
    Возвращает:
    - скорректированный риск (%)
    """
    if pd.isna(rsi):
        return risk_pct
    
    # ✅ УМЕНЬШЕНИЕ риска при плохих условиях
    if rsi < 45 or trend == "Downtrend":
        return risk_pct * 0.7
    elif rsi > 60 and trend == "Uptrend":
        return risk_pct * 0.85
    
    # ✅ УВЕЛИЧЕНИЕ риска при сильном тренде и хороших сигналах
    # Условия для увеличения:
    # 1. Сильный тренд (ADX > 30) ИЛИ высокий рейтинг надёжности (>80%)
    # 2. RSI в оптимальном диапазоне (50-70 для лонга, 30-50 для шорта)
    # 3. Тренд совпадает с направлением сделки
    should_increase = False
    increase_factor = 1.0
    
    # Проверяем сильный тренд
    if adx is not None and not pd.isna(adx) and adx > 30:
        should_increase = True
        increase_factor = 1.15  # Увеличиваем на 15% при сильном тренде
    
    # Проверяем высокий рейтинг надёжности
    if reliability_rating is not None and reliability_rating > 80:
        should_increase = True
        increase_factor = max(increase_factor, 1.1)  # Увеличиваем на 10% при высокой надёжности
    
    # Проверяем оптимальный RSI для тренда
    if trend == "Uptrend" and 50 <= rsi <= 70:
        if should_increase:
            increase_factor = min(increase_factor * 1.1, 1.3)  # Дополнительно до 30% максимум
    elif trend == "Downtrend" and 30 <= rsi <= 50:
        if should_increase:
            increase_factor = min(increase_factor * 1.1, 1.3)
    
    if should_increase:
        return risk_pct * increase_factor
    
    # Базовый риск без изменений
    return risk_pct

def calculate_entry(row, strat, direction):
    """
    Рассчитывает уровень входа на основе entry_type стратегии.
    
    Параметры:
    - row: строка DataFrame с индикаторами (должна содержать Close, EMA_20, EMA_50, High, Low)
    - strat: словарь стратегии (должен содержать entry_type и ema_buffer)
    - direction: "long" или "short"
    
    Возвращает:
    - entry: цена входа (валидированная против High/Low свечи)
    """
    entry_type = strat.get("entry_type", "ema20")
    ema_buffer = strat.get("ema_buffer", 0)
    current_price = row.get("Close", 0)
    high = row.get("High", current_price)
    low = row.get("Low", current_price)
    
    # Рассчитываем базовый entry
    if entry_type == "close":
        entry = current_price
    elif entry_type == "ema50":
        ema = row.get("EMA_50", current_price)
        if direction == "long":
            entry = ema * (1 + ema_buffer)
        else:
            entry = ema * (1 - ema_buffer)
    elif entry_type == "ema20":
        ema = row.get("EMA_20", current_price)
        if direction == "long":
            entry = ema * (1 + ema_buffer)
        else:
            entry = ema * (1 - ema_buffer)
    else:
        # Fallback: по умолчанию EMA20
        ema = row.get("EMA_20", current_price)
        if direction == "long":
            entry = ema * (1 + ema_buffer)
        else:
            entry = ema * (1 - ema_buffer)
    
    # ✅ ВАЛИДАЦИЯ: entry_price должен быть реализуемым (в пределах High/Low свечи)
    if direction == "long":
        # Для лонга: entry не может быть выше High свечи
        if entry > high:
            # Если EMA выше High, используем Close или High (в зависимости от стратегии)
            # Для консервативности используем Close, но не выше High
            entry = min(current_price, high)
    else:  # short
        # Для шорта: entry не может быть ниже Low свечи
        if entry < low:
            # Если EMA ниже Low, используем Close или Low
            entry = max(current_price, low)
    
    return entry

def position_size(capital, risk_pct, entry, stop):
    try:
        risk_usd = capital * risk_pct
        dist = abs(entry - stop)
        if dist <= 1e-9:
            return 0, 0
        units = risk_usd / dist
        dollars = units * entry
        return units, dollars
    except Exception:
        return 0, 0

def calculate_rr(entry, stop_loss, take_profit):
    """
    Рассчитывает R:R на основе реальных уровней входа, стоп-лосса и тейк-профита.
    
    Параметры:
    - entry: цена входа
    - stop_loss: цена стоп-лосса
    - take_profit: цена тейк-профита
    
    Возвращает:
    - R:R (отношение расстояния до TP к расстоянию до SL)
    """
    sl_dist = abs(entry - stop_loss)
    if sl_dist < 1e-9:
        return 0
    tp_dist = abs(take_profit - entry)
    return round(tp_dist / sl_dist, 2)

def dynamic_rr(entry, sl, atr, adx, trend_dir):
    sl_dist = abs(entry - sl)
    if sl_dist < 1e-9:
        return 0

    tp_mult = 1.5
    if adx >= 25:
        tp_mult *= 1.2
    elif adx < 20:
        tp_mult *= 0.8

    if trend_dir == "Uptrend":
        tp = entry + tp_mult * atr
    else:
        tp = entry - tp_mult * atr

    rr = abs(tp - entry) / sl_dist
    return round(rr, 2)

def check_confirmations(row, selected, prev_row=None, language="ru"):
    indicators_map = {
        "EMA": row["EMA_50"] > row["EMA_200"],
        "RSI": row["RSI_14"] > 50,
        "MACD": row["MACD"] > row["Signal_Line"],
        "ADX": row["ADX"] > 25,
        "VWMA": row["Close"] > row.get("VWMA_20", 0),
        # BB: консервативный «возврат внутрь полос»
        "BB": (
            (
                prev_row is not None and
                prev_row["Close"] < prev_row.get("BB_lower", 0) and
                row["Close"] >= row.get("BB_lower", 0)
            ) or (
                prev_row is not None and
                prev_row["Close"] > prev_row.get("BB_upper", 0) and
                row["Close"] <= row.get("BB_upper", 0)
            ) or (
                # если нет prev_row — просто внутри полос
                prev_row is None and
                row["Close"] >= row.get("BB_lower", 0) and
                row["Close"] <= row.get("BB_upper", 0)
            )
        ),
    }
    t = lambda key: get_report_translation(key, language)
    
    if not selected:
        return t("no_confirmations"), 0, 0, 0.0

    passed = []
    failed = []

    if "ALL" in selected:
        for ind, cond in indicators_map.items():
            if cond:
                passed.append(ind)
            else:
                failed.append(ind)
        total = len(indicators_map)
    else:
        for ind in selected:
            ind_upper = ind.upper()
            if indicators_map.get(ind_upper, False):
                passed.append(ind_upper)
            else:
                failed.append(ind_upper)
        total = len(selected)

    # Рассчитываем рейтинг надёжности (0-100%)
    reliability_rating = (len(passed) / total * 100) if total > 0 else 0

    if not passed:
        return f"{t('no_confirmations')} ❌", 0, total, reliability_rating
    elif len(passed) == total:
        return f"{t('all_confirmations')} ✅", len(passed), total, reliability_rating
    else:
        return f"{t('partially_confirmed')} ({len(passed)}/{total}): " + \
               ", ".join([f"{i} ✅" for i in passed] + [f"{i} ❌" for i in failed]), len(passed), total, reliability_rating

def smart_combine_indicators(symbol, trading_type="Дейтрейдинг", timeframe=None, language="ru"):
    """
    Автоматически определяет оптимальные индикаторы под текущий режим рынка.
    Возвращает список индикаторов и причину выбора.
    
    Параметры:
    - symbol: торговый символ (например, "BTC/USDT")
    - trading_type: тип торговли (для определения дефолтного таймфрейма)
    - timeframe: конкретный таймфрейм (если None - используется дефолтный для trading_type)
    - language: язык для сообщений об ошибках
    """
    try:
        if timeframe is None:
            timeframe = DEFAULT_TIMEFRAMES.get(trading_type, "1h")
        range_days = TRADING_HISTORY_DAYS.get(trading_type, 30)
        
        df = fetch_ohlcv(symbol, timeframe, history_days=range_days)
        if df.empty:
            t = lambda key: get_report_translation(key, language, default=key)
            return ["EMA", "RSI"], t("error_insufficient_data")
        
        df = add_indicators(df)
        df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
        df["BB_middle"] = df["Close"].rolling(20).mean()
        df["BB_std"] = df["Close"].rolling(20).std()
        df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
        df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
        df["ADX"] = compute_adx(df).fillna(0)
        
        # Отбираем строки с валидными Close и ATR_14
        df_valid = df.dropna(subset=["Close", "ATR_14"])
        if df_valid.empty:
            t = lambda key: get_report_translation(key, language, default=key)
            return ["EMA", "RSI"], t("error_insufficient_data_atr")
        
        latest = df_valid.iloc[-1]
        adx = latest.get("ADX", 0)
        trend = latest.get("Trend", "Uptrend")
        rsi = latest.get("RSI_14", 50)
        atr = latest.get("ATR_14", 0)
        ema50 = latest.get("EMA_50", 0)
        ema200 = latest.get("EMA_200", 0)
        
        # Определяем режим рынка
        is_trending = adx >= 25
        is_volatile = atr > df["ATR_14"].rolling(20).mean().iloc[-1] if len(df) > 20 else False
        
        # Логика выбора индикаторов
        indicators = []
        reason_parts = []
        
        # Получаем значения индикаторов для проверки важных сигналов
        macd = latest.get("MACD", 0)
        signal_line = latest.get("Signal_Line", 0)
        bb_upper = latest.get("BB_upper", None)
        bb_lower = latest.get("BB_lower", None)
        current_price = latest.get("Close", 0)
        
        # Проверяем важные сигналы MACD (дивергенция или сильный сигнал)
        macd_strong_signal = False
        if not pd.isna(macd) and not pd.isna(signal_line):
            # Сильный бычий сигнал: MACD выше сигнала и растет
            macd_strong_signal = (macd > signal_line and macd > 0) or (macd < signal_line and macd < 0)
        
        # Проверяем важные сигналы BB (пробой границ или близость к ним)
        bb_important_signal = False
        if bb_upper is not None and bb_lower is not None and not pd.isna(bb_upper) and not pd.isna(bb_lower):
            # Пробой верхней или нижней границы, или близость к границам (<5% от диапазона)
            bb_range = bb_upper - bb_lower
            if bb_range > 0:
                distance_to_upper = (bb_upper - current_price) / bb_range
                distance_to_lower = (current_price - bb_lower) / bb_range
                bb_important_signal = (distance_to_upper < 0.05 or distance_to_lower < 0.05 or 
                                      current_price >= bb_upper or current_price <= bb_lower)
        
        if is_trending:
            # Трендовый рынок: используем трендовые индикаторы
            indicators.append("EMA")
            indicators.append("ADX")
            indicators.append("VWMA")
            reason_parts.append("трендовый рынок")
            
            # ✅ УЛУЧШЕНО: Добавляем MACD и BB даже в тренде, если они дают важные сигналы
            if macd_strong_signal and "MACD" not in indicators:
                indicators.append("MACD")
                reason_parts.append("сильный сигнал MACD")
            
            if bb_important_signal and "BB" not in indicators:
                indicators.append("BB")
                reason_parts.append("важный сигнал BB")
        else:
            # Флет: используем осцилляторы
            indicators.append("RSI")
            indicators.append("MACD")
            if not pd.isna(rsi) and (rsi < 30 or rsi > 70):
                indicators.append("BB")
                reason_parts.append("флет с экстремальными уровнями")
            else:
                reason_parts.append("флет")
        
        # Добавляем ADX для оценки силы тренда (если ещё не добавлен)
        if "ADX" not in indicators and is_trending:
            pass  # уже добавлен выше
        
        # Если высокая волатильность, добавляем BB для управления риском
        if is_volatile and "BB" not in indicators:
            indicators.append("BB")
            reason_parts.append("высокая волатильность")
        
        reason = ", ".join(reason_parts) if reason_parts else "балансированный рынок"
        
        return indicators, reason
    except Exception as e:
        print(f"⚠️ Ошибка Smart Combine: {e}")
        traceback.print_exc()
        t = lambda key: get_report_translation(key, language, default=key)
        return ["EMA", "RSI"], t("error_analysis")

def backtest_strategy(df, strategy, trading_type, confirmation, capital=10000, risk=0.01, commission=0.001, spread=0.0):
    """
    Бэктестинг стратегии на исторических данных.
    
    Параметры:
    - df: DataFrame с историческими данными и индикаторами
    - strategy: название стратегии
    - trading_type: тип торговли
    - confirmation: список подтверждений
    - capital: начальный капитал
    - risk: риск на сделку (%)
    - commission: комиссия биржи (0.1% = 0.001)
    
    Возвращает:
    - total_trades: общее количество сделок
    - winning_trades: количество прибыльных
    - losing_trades: количество убыточных
    - win_rate: процент прибыльных сделок
    - total_profit_pct: общая прибыль (%)
    - max_drawdown: максимальная просадка (%)
    - avg_rr: средний R:R
    - equity_curve: список значений капитала (для графика)
    """
    try:
        if df.empty or len(df) < 100:
            return None
        
        strat = STRATEGIES.get(strategy, STRATEGIES["Сбалансированная"])
        current_capital = capital
        max_capital = capital
        equity_curve = [capital]
        trades = []
        
        # ✅ Добавляем VWMA и BB для использования в гибридном подходе
        df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
        df["BB_middle"] = df["Close"].rolling(20).mean()
        df["BB_std"] = df["Close"].rolling(20).std()
        df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
        df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
        df["ADX"] = compute_adx(df).fillna(0)
        
        # Парсим подтверждения
        user_selected = []
        if isinstance(confirmation, str):
            conf_str = confirmation.strip()
            if conf_str.upper() in ("NONE", "", "N/A"):
                user_selected = []
            elif conf_str.upper() == "ALL":
                user_selected = ["ALL"]
            else:
                user_selected = [s.strip().upper() for s in conf_str.split("+") if s.strip()]
        elif isinstance(confirmation, (list, tuple)):
            user_selected = [str(c).strip().upper() for c in confirmation if str(c).strip()]
        elif confirmation is not None:
            user_selected = [str(confirmation).strip().upper()]
        
        # ✅ ИСПРАВЛЕНО: Добавляем счетчики для отладки
        trades_found = 0
        trades_skipped_no_conf = 0
        trades_skipped_no_entry = 0
        
        # Проходим по истории и ищем сигналы
        for i in range(100, len(df) - 1):  # Пропускаем первые 100 свечей для индикаторов
            row = df.iloc[i]
            prev_row = df.iloc[i-1] if i > 0 else None
            
            # Проверяем подтверждения
            conf_result, passed_count, total_count, _ = check_confirmations(row, user_selected, prev_row=prev_row, language="ru")
            
            # Если подтверждения не пройдены, пропускаем
            if not user_selected or passed_count == 0:
                trades_skipped_no_conf += 1
                continue
            
            # Определяем направление
            trend = row.get("Trend", "Uptrend")
            direction = "long" if trend == "Uptrend" else "short"
            
            # ✅ ГИБРИДНЫЙ ПОДХОД: Вычисляем уровни входа/выхода с учетом индикаторов
            atr = row.get("ATR_14", np.nan)
            current_price = row.get("Close", 0)
            
            # ✅ FALLBACK для ATR: если ATR нулевой или слишком мал, используем минимальный ATR (0.1% от цены)
            if pd.isna(atr) or atr == 0 or atr < current_price * 0.001:
                atr = current_price * 0.001  # Минимальный ATR = 0.1% от цены
            
            ema20 = row.get("EMA_20", 0)
            ema50 = row.get("EMA_50", 0)
            ema200 = row.get("EMA_200", 0)
            
            # Получаем значения индикаторов для корректировки
            macd = row.get("MACD", 0)
            signal_line = row.get("Signal_Line", 0)
            adx = row.get("ADX", 0)
            vwma = row.get("VWMA_20", None)
            bb_upper = row.get("BB_upper", None)
            bb_lower = row.get("BB_lower", None)
            current_price = row.get("Close", 0)
            
            # ✅ Используем calculate_entry для согласованности с run_analysis
            base_entry = calculate_entry(row, strat, direction)
            
            # ✅ MACD: влияет на момент входа (смещение)
            macd_offset = 0
            if not pd.isna(macd) and not pd.isna(signal_line):
                if macd > signal_line:
                    # Бычий MACD - более агрессивный вход (ближе к цене)
                    macd_offset = atr * 0.05  # Смещение на 5% от ATR
                else:
                    # Медвежий MACD - более консервативный вход
                    macd_offset = -atr * 0.05
            
            # ✅ VWMA: влияет на уровень входа (смещение к VWMA)
            vwma_weight = 0.0  # По умолчанию не влияет
            if vwma is not None and not pd.isna(vwma) and "VWMA" in user_selected:
                vwma_weight = 0.3  # 30% веса VWMA
                if direction == "long":
                    # Для лонга: смещаем вход к VWMA, если она выше
                    entry = base_entry * (1 - vwma_weight) + vwma * vwma_weight
                else:
                    # Для шорта: смещаем вход к VWMA, если она ниже
                    entry = base_entry * (1 - vwma_weight) + vwma * vwma_weight
            else:
                entry = base_entry
            
            # Применяем MACD смещение
            entry = entry + macd_offset
            
            # Базовые уровни TP/SL
            if direction == "long":
                base_stop_loss = entry - strat["atr_sl"] * atr
                base_take_profit = entry + strat["atr_tp"] * atr
            else:
                base_stop_loss = entry + strat["atr_sl"] * atr
                base_take_profit = entry - strat["atr_tp"] * atr
            
            # ✅ BB: влияет на TP/SL (корректировка при близости к границам)
            tp_multiplier = 1.0
            sl_multiplier = 1.0
            if bb_upper is not None and bb_lower is not None and not pd.isna(bb_upper) and not pd.isna(bb_lower) and "BB" in user_selected:
                bb_range = bb_upper - bb_lower
                if bb_range > 0:
                    if direction == "long":
                        # Для лонга: если цена близко к верхней границе BB, более консервативный TP
                        distance_to_upper = (bb_upper - current_price) / bb_range
                        if distance_to_upper < 0.2:  # В пределах 20% от верхней границы
                            tp_multiplier = 0.85  # Уменьшаем TP на 15%
                        # Если цена близко к нижней границе, более консервативный SL
                        distance_to_lower = (current_price - bb_lower) / bb_range
                        if distance_to_lower < 0.2:  # В пределах 20% от нижней границы
                            sl_multiplier = 0.9  # Уменьшаем SL на 10%
                    else:  # short
                        # Для шорта: если цена близко к нижней границе BB, более консервативный TP
                        distance_to_lower = (current_price - bb_lower) / bb_range
                        if distance_to_lower < 0.2:  # В пределах 20% от нижней границы
                            tp_multiplier = 0.85  # Уменьшаем TP на 15%
                        # Если цена близко к верхней границе, более консервативный SL
                        distance_to_upper = (bb_upper - current_price) / bb_range
                        if distance_to_upper < 0.2:  # В пределах 20% от верхней границы
                            sl_multiplier = 0.9  # Уменьшаем SL на 10%
            
            # Применяем множители к TP/SL
            if direction == "long":
                stop_loss_price = entry - (strat["atr_sl"] * atr * sl_multiplier)
                take_profit_price = entry + (strat["atr_tp"] * atr * tp_multiplier)
            else:
                stop_loss_price = entry + (strat["atr_sl"] * atr * sl_multiplier)
                take_profit_price = entry - (strat["atr_tp"] * atr * tp_multiplier)
            
            # ✅ ГИБРИДНЫЙ ПОДХОД: Проверяем, был бы вход исполнен (touch-based)
            # Цена должна коснуться уровня входа в текущей или следующих свечах
            entry_touched = False
            actual_entry_bar = i
            max_entry_check_bars = 3  # Проверяем текущую свечу и 2 следующие
            
            for check_bar in range(i, min(i + max_entry_check_bars, len(df))):
                check_row = df.iloc[check_bar]
                if direction == "long":
                    # Для лонга: вход исполняется, если Low коснулся или пересек уровень входа
                    if check_row["Low"] <= entry:
                        entry_touched = True
                        actual_entry_bar = check_bar
                        break
                else:  # short
                    # Для шорта: вход исполняется, если High коснулся или пересек уровень входа
                    if check_row["High"] >= entry:
                        entry_touched = True
                        actual_entry_bar = check_bar
                        break
            
            # Пропускаем сделку, если вход не был бы исполнен
            if not entry_touched:
                trades_skipped_no_entry += 1
                continue
            
            trades_found += 1
            
            # ✅ ГИБРИДНЫЙ ПОДХОД: Вычисляем размер позиции с учетом ADX
            # Передаем ADX и reliability_rating для возможности увеличения риска
            reliability_rating = None
            if passed_count > 0 and total_count > 0:
                reliability_rating = (passed_count / total_count) * 100
            risk_adj = dynamic_risk(risk, row.get("RSI_14", 50), trend, adx=adx, reliability_rating=reliability_rating)
            
            # ✅ Защита от None
            if risk_adj is None:
                risk_adj = risk  # Fallback на базовый риск
            
            # ✅ ADX: дополнительно влияет на размер позиции
            adx_multiplier = 1.0
            if not pd.isna(adx) and "ADX" in user_selected:
                if adx > 25:
                    # Сильный тренд - увеличиваем позицию на 10%
                    adx_multiplier = 1.1
                elif adx < 20:
                    # Слабый тренд - уменьшаем позицию на 10%
                    adx_multiplier = 0.9
            
            risk_adj = risk_adj * adx_multiplier
            risk_usd = current_capital * risk_adj
            sl_dist = abs(entry - stop_loss_price)
            if sl_dist <= 1e-9:
                continue
            
            units = risk_usd / sl_dist
            position_value = units * entry
            
            # Защита: размер позиции не может превышать доступный капитал
            if position_value > current_capital:
                position_value = current_capital
                units = position_value / entry
            
            # Защита от отрицательного капитала
            if current_capital <= 0:
                break
            
            # Симулируем сделку - проверяем, достигнут ли TP или SL
            # Начинаем проверку с момента фактического входа (actual_entry_bar)
            entry_bar = actual_entry_bar
            exit_bar = None
            exit_price = None
            profit_pct = 0
            success = False
            
            # Проверяем TP/SL начиная со свечи после входа
            for j in range(actual_entry_bar + 1, min(actual_entry_bar + 200, len(df))):  # Проверяем следующие 200 свечей после входа
                future_row = df.iloc[j]
                high = future_row["High"]
                low = future_row["Low"]
                
                if direction == "long":
                    if high >= take_profit_price:
                        exit_price = take_profit_price
                        exit_bar = j
                        profit_pct = ((take_profit_price - entry) / entry) * 100
                        success = True
                        break
                    elif low <= stop_loss_price:
                        exit_price = stop_loss_price
                        exit_bar = j
                        profit_pct = ((stop_loss_price - entry) / entry) * 100
                        success = False
                        break
                else:  # short
                    if low <= take_profit_price:
                        exit_price = take_profit_price
                        exit_bar = j
                        profit_pct = ((entry - take_profit_price) / entry) * 100
                        success = True
                        break
                    elif high >= stop_loss_price:
                        exit_price = stop_loss_price
                        exit_bar = j
                        profit_pct = ((entry - stop_loss_price) / entry) * 100
                        success = False
                        break
            
            # Если не достигнут ни TP, ни SL - закрываем по текущей цене
            closed_by_time = False
            if exit_price is None:
                # Используем actual_entry_bar для корректного расчета времени удержания
                final_row = df.iloc[min(actual_entry_bar + 200, len(df) - 1)]
                exit_price = final_row["Close"]
                exit_bar = min(actual_entry_bar + 200, len(df) - 1)
                if direction == "long":
                    profit_pct = ((exit_price - entry) / entry) * 100
                else:
                    profit_pct = ((entry - exit_price) / entry) * 100
                success = profit_pct > 0
                closed_by_time = True
            
            # Вычисляем прибыль/убыток с учётом комиссии
            # Правильный расчёт: прибыль/убыток от размера риска, а не от всей позиции
            tp_dist = abs(take_profit_price - entry)
            sl_dist_actual = abs(entry - stop_loss_price)
            
            if closed_by_time:
                # Если закрыто по времени, рассчитываем прибыль пропорционально фактическому движению
                actual_price_move = abs(exit_price - entry)
                if sl_dist_actual > 0:
                    # Прибыль/убыток пропорциональны движению относительно риска
                    profit_usd = risk_usd * (actual_price_move / sl_dist_actual) * (1 if success else -1)
                else:
                    profit_usd = -risk_usd  # Если SL расстояние = 0, считаем убытком
            elif success:
                # Прибыльная сделка (достигнут TP): получаем risk_usd * R:R
                rr_actual = tp_dist / sl_dist_actual if sl_dist_actual > 0 else 0
                profit_usd = risk_usd * rr_actual
            else:
                # Убыточная сделка (достигнут SL): теряем risk_usd
                profit_usd = -risk_usd
            
            # Комиссия рассчитывается от реальной стоимости позиции
            commission_entry = position_value * commission
            exit_position_value = abs(units * exit_price)
            commission_exit = exit_position_value * commission
            total_commission = commission_entry + commission_exit
            
            # Вычитаем комиссию из прибыли
            profit_usd -= total_commission
            
            # ✅ Учитываем спред биржи (спред применяется при входе и выходе)
            # Спред в процентах (например, 0.1 = 0.1%)
            if spread > 0:
                spread_amount = position_value * (spread / 100) * 2  # Спред при входе и выходе
                profit_usd -= spread_amount
            
            # Защита: прибыль не может превышать разумные пределы
            # Ограничиваем максимум 1000% от риска (для очень больших R:R)
            max_profit_from_risk = risk_usd * 10
            if profit_usd > max_profit_from_risk:
                profit_usd = max_profit_from_risk
            
            # Дополнительная защита: прибыль не может превышать текущий капитал
            # Это предотвращает экспоненциальный рост
            if profit_usd > current_capital * 0.5:
                profit_usd = current_capital * 0.5  # Максимум 50% от текущего капитала
            
            current_capital += profit_usd
            
            # Защита от отрицательного капитала
            if current_capital < 0:
                current_capital = 0
            
            # Защита от аномального роста капитала (максимум 10x от начального)
            max_reasonable_capital = capital * 11  # Максимум 10x + небольшой запас
            if current_capital > max_reasonable_capital:
                current_capital = max_reasonable_capital
            
            # Обновляем максимальный капитал для просадки
            if current_capital > max_capital:
                max_capital = current_capital
            
            # Сохраняем сделку
            trades.append({
                "entry": entry,
                "exit": exit_price,
                "profit_pct": profit_pct,
                "profit_usd": profit_usd,
                "success": success,
                "capital_after": current_capital
            })
            
            equity_curve.append(current_capital)
            
            # ✅ ИСПРАВЛЕНО: Логирование первых 5 сделок для отладки
            if len(trades) <= 5:
                print(f"📊 Бэктест сделка {len(trades)}: entry={entry:.2f}, exit={exit_price:.2f}, profit_usd={profit_usd:.2f}, capital={current_capital:.2f}, success={success}")
        
        # ✅ ИСПРАВЛЕНО: Улучшенная обработка случая без сделок
        if not trades:
            print(f"⚠️ Бэктест: не найдено сделок. Пропущено без подтверждений: {trades_skipped_no_conf}, без входа: {trades_skipped_no_entry}")
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0,
                "total_profit_pct": 0,
                "max_drawdown": 0,
                "avg_rr": 0,
                "final_capital": capital,
                "equity_curve": [capital]
            }
        
        print(f"✅ Бэктест: найдено {len(trades)} сделок, прибыльных: {sum(1 for t in trades if t['success'])}, финальный капитал: {current_capital:.2f}")
        print(f"📊 Статистика бэктеста: пропущено без подтверждений: {trades_skipped_no_conf}, пропущено без входа: {trades_skipped_no_entry}, найдено сделок: {trades_found}")
        
        # Вычисляем метрики
        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t["success"])
        losing_trades = total_trades - winning_trades
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Защита от аномального роста капитала перед расчетом прибыли
        max_reasonable_capital = capital * 11  # Максимум 10x от начального капитала
        if current_capital > max_reasonable_capital:
            current_capital = max_reasonable_capital
        
        # Общая прибыль в процентах от начального капитала
        if capital > 0 and current_capital > 0:
            total_profit_pct = ((current_capital - capital) / capital) * 100
        elif capital > 0:
            # Если капитал стал 0 или отрицательным
            total_profit_pct = -100.0
        else:
            total_profit_pct = 0.0  # Если начальный капитал был 0
        
        # Ограничиваем разумными пределами: от -100% до +1000% (10x)
        if total_profit_pct < -100:
            total_profit_pct = -100.0
        if total_profit_pct > 1000:
            total_profit_pct = 1000.0  # Ограничиваем максимум 1000% (вместо 10000%)
        
        # Максимальная просадка
        max_drawdown = 0
        peak = capital
        for equity in equity_curve:
            if equity > peak:
                peak = equity
            drawdown = ((peak - equity) / peak) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # Средний R:R
        rr_values = []
        for t in trades:
            if t["success"]:
                # Упрощённый расчёт R:R
                entry = t["entry"]
                exit = t["exit"]
                profit = abs(exit - entry)
                # Предполагаем, что риск был 1% от капитала
                risk_amount = entry * 0.01
                if risk_amount > 0:
                    rr = profit / risk_amount
                    rr_values.append(rr)
        avg_rr = np.mean(rr_values) if rr_values else 0
        
        return {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate": win_rate,
            "total_profit_pct": round(total_profit_pct, 2),
            "max_drawdown": round(max_drawdown, 2),
            "avg_rr": round(avg_rr, 2),
            "final_capital": round(max(current_capital, 0), 2),  # Не показываем отрицательный капитал
            "equity_curve": equity_curve[-100:] if len(equity_curve) > 100 else equity_curve
        }
    
    except Exception as e:
        print(f"⚠️ Ошибка в backtest_strategy: {e}")
        traceback.print_exc()
        return None

def forecast_risk_reward(df, latest, strategy, direction, similarity_threshold=0.15):
    """
    Прогнозирует риск/доход на основе похожих ситуаций в истории.
    
    Для каждой похожей исторической ситуации пересчитывает entry, SL, TP
    на основе исторических ATR и EMA для математической корректности.
    
    Параметры:
    - df: DataFrame с историческими данными и индикаторами
    - latest: текущая свеча
    - strategy: название стратегии (для получения параметров)
    - direction: "long" или "short"
    - similarity_threshold: порог схожести (15% отклонение по индикаторам)
    
    Возвращает:
    - expected_profit: ожидаемая прибыль (%)
    - success_probability: вероятность успеха (%)
    - risk_range: диапазон риска (min, max)
    - similar_cases: количество похожих случаев
    """
    try:
        if df.empty or len(df) < 50:
            return None, None, None, 0
        
        # Получаем параметры стратегии
        strat = STRATEGIES.get(strategy, STRATEGIES["Сбалансированная"])
        
        # Нормализуем текущие значения индикаторов для сравнения
        current_rsi = latest.get("RSI_14", 50)
        current_adx = latest.get("ADX", 0)
        current_trend = 1 if latest.get("Trend") == "Uptrend" else -1
        current_ema20 = latest.get("EMA_20", 0)
        current_ema50 = latest.get("EMA_50", 0)
        current_price = latest.get("Close", 0)
        
        if current_price == 0:
            return None, None, None, 0
        
        # Ищем похожие ситуации в истории
        similar_trades = []
        
        for i in range(50, len(df) - 1):  # Пропускаем последние 50 свечей для валидности
            row = df.iloc[i]
            prev_row = df.iloc[i-1] if i > 0 else None
            
            # Вычисляем схожесть по индикаторам
            rsi_diff = abs(row.get("RSI_14", 50) - current_rsi) / max(current_rsi, 1)
            adx_diff = abs(row.get("ADX", 0) - current_adx) / max(current_adx, 1) if current_adx > 0 else 1
            trend_match = 1 if (row.get("Trend") == "Uptrend") == (latest.get("Trend") == "Uptrend") else 0
            
            # Проверяем схожесть
            if rsi_diff <= similarity_threshold and adx_diff <= similarity_threshold and trend_match:
                # ✅ ПОДХОД 2: Пересчитываем entry, SL, TP для каждой исторической ситуации
                # на основе исторических ATR и EMA для математической корректности
                historical_entry = calculate_entry(row, strat, direction)
                historical_atr = row.get("ATR_14", np.nan)
                historical_price = row.get("Close", 0)
                
                # ✅ FALLBACK для ATR: если ATR нулевой или слишком мал, используем минимальный ATR
                if pd.isna(historical_atr) or historical_atr == 0 or historical_atr < historical_price * 0.001:
                    historical_atr = historical_price * 0.001  # Минимальный ATR = 0.1% от цены
                
                # Пересчитываем SL/TP на основе исторических данных
                if direction == "long":
                    historical_stop_loss = historical_entry - strat["atr_sl"] * historical_atr
                    historical_take_profit = historical_entry + strat["atr_tp"] * historical_atr
                else:  # short
                    historical_stop_loss = historical_entry + strat["atr_sl"] * historical_atr
                    historical_take_profit = historical_entry - strat["atr_tp"] * historical_atr
                
                # Вычисляем расстояние до SL и TP для расчета прибыли относительно риска
                historical_sl_dist = abs(historical_entry - historical_stop_loss)
                historical_tp_dist = abs(historical_take_profit - historical_entry)
                
                # Вычисляем результат сделки используя исторические SL/TP
                if direction == "long":
                    # Для лонга: цена должна вырасти до TP или упасть до SL
                    # Проверяем, достигнут ли исторический TP или SL в следующих свечах
                    for j in range(i + 1, min(i + 50, len(df))):  # Проверяем следующие 50 свечей
                        future_row = df.iloc[j]
                        high = future_row["High"]
                        low = future_row["Low"]
                        
                        if high >= historical_take_profit:
                            # Исторический TP достигнут - прибыль = R:R * 100% (от риска)
                            if historical_sl_dist > 1e-9:
                                rr_actual = historical_tp_dist / historical_sl_dist
                                profit_pct = rr_actual * 100  # Прибыль в процентах от риска
                            else:
                                profit_pct = 0
                            similar_trades.append({"profit": profit_pct, "success": True})
                            break
                        elif low <= historical_stop_loss:
                            # Исторический SL достигнут - убыток = -100% от риска
                            profit_pct = -100.0
                            similar_trades.append({"profit": profit_pct, "success": False})
                            break
                    else:
                        # Не достигнут ни TP, ни SL за 50 свечей - считаем пропорционально движению
                        final_price = df.iloc[min(i + 50, len(df) - 1)]["Close"]
                        price_move = abs(final_price - historical_entry)
                        if historical_sl_dist > 1e-9:
                            # Прибыль/убыток пропорциональны движению относительно исторического риска
                            profit_pct = (price_move / historical_sl_dist) * 100 * (1 if final_price > historical_entry else -1)
                        else:
                            profit_pct = 0
                        similar_trades.append({"profit": profit_pct, "success": profit_pct > 0})
                else:  # short
                    for j in range(i + 1, min(i + 50, len(df))):
                        future_row = df.iloc[j]
                        high = future_row["High"]
                        low = future_row["Low"]
                        
                        if low <= historical_take_profit:
                            # Исторический TP достигнут (для шорта цена упала) - прибыль = R:R * 100%
                            if historical_sl_dist > 1e-9:
                                rr_actual = historical_tp_dist / historical_sl_dist
                                profit_pct = rr_actual * 100
                            else:
                                profit_pct = 0
                            similar_trades.append({"profit": profit_pct, "success": True})
                            break
                        elif high >= historical_stop_loss:
                            # Исторический SL достигнут - убыток = -100% от риска
                            profit_pct = -100.0
                            similar_trades.append({"profit": profit_pct, "success": False})
                            break
                    else:
                        final_price = df.iloc[min(i + 50, len(df) - 1)]["Close"]
                        price_move = abs(historical_entry - final_price)
                        if historical_sl_dist > 1e-9:
                            profit_pct = (price_move / historical_sl_dist) * 100 * (1 if final_price < historical_entry else -1)
                        else:
                            profit_pct = 0
                        similar_trades.append({"profit": profit_pct, "success": profit_pct > 0})
        
        if not similar_trades:
            return None, None, None, 0
        
        # Вычисляем статистику
        profits = [t["profit"] for t in similar_trades]
        successes = [t["success"] for t in similar_trades]
        
        # Вероятность успеха: считаем только сделки, где success = True
        success_count = sum(1 for s in successes if s)
        success_probability = (success_count / len(successes)) * 100 if len(successes) > 0 else 0
        
        # Ожидаемая прибыль: среднее всех прибылей
        expected_profit = np.mean(profits)
        
        # Если вероятность успеха 100%, но средняя прибыль отрицательная - это ошибка логики
        # Пересчитываем: если все сделки успешные, средняя прибыль должна быть положительной
        if success_probability >= 99.9 and expected_profit < 0:
            # Берем только успешные сделки для расчета ожидаемой прибыли
            successful_profits = [p for p, s in zip(profits, successes) if s]
            if len(successful_profits) > 0:
                expected_profit = np.mean(successful_profits)
            else:
                expected_profit = 0
        
        # Если вероятность успеха высокая (>80%), но средняя прибыль сильно отрицательная - корректируем
        # Возможно, есть выбросы - используем медиану успешных сделок
        if success_probability > 80 and expected_profit < -50:
            successful_profits = [p for p, s in zip(profits, successes) if s]
            if len(successful_profits) > 0:
                # Используем медиану успешных сделок вместо среднего всех
                expected_profit = np.median(successful_profits)
        
        risk_min = min(profits)
        risk_max = max(profits)
        
        return expected_profit, success_probability, (risk_min, risk_max), len(similar_trades)
    
    except Exception as e:
        print(f"⚠️ Ошибка в forecast_risk_reward: {e}")
        traceback.print_exc()
        return None, None, None, 0

def predict_ml_success(current_params, historical_reports, similarity_threshold=0.2):
    """
    ML-прогноз вероятности успеха на основе похожих паттернов из истории.
    
    Параметры:
    - current_params: dict с текущими параметрами (strategy, trading_type, direction, trend, rr_long, rr_short, confirmation)
    - historical_reports: список объектов ReportV2 из БД
    - similarity_threshold: порог схожести (20% отклонение)
    
    Возвращает:
    - success_probability: вероятность успеха (%)
    - similar_cases: количество похожих случаев
    - confidence_level: уровень уверенности ("high"/"medium"/"low" - ключи для перевода)
    """
    try:
        if not historical_reports or len(historical_reports) < 5:
            return None, 0, "low"
        
        similar_reports = []
        
        # Извлекаем текущие параметры
        current_strategy = current_params.get("strategy", "")
        current_trading_type = current_params.get("trading_type", "")
        current_direction = current_params.get("direction", "")
        current_trend = current_params.get("trend", "")
        current_rr = current_params.get("rr_long") or current_params.get("rr_short") or 0
        current_confirmation = current_params.get("confirmation", "")
        
        # Нормализуем confirmation для сравнения
        current_conf_set = set([c.strip().upper() for c in str(current_confirmation).split("+") if c.strip()])
        
        # Ищем похожие случаи
        for report in historical_reports:
            if report.success is None:  # Пропускаем отчёты без результата
                continue
            
            # Проверяем схожесть по параметрам
            strategy_match = (report.strategy == current_strategy) if report.strategy else False
            trading_type_match = (report.trading_type == current_trading_type) if report.trading_type else False
            direction_match = (report.direction == current_direction) if report.direction else False
            trend_match = (report.trend == current_trend) if report.trend else False
            
            # Сравниваем R:R (с допуском)
            report_rr = report.rr_long or report.rr_short or 0
            rr_diff = abs(report_rr - current_rr) / max(current_rr, 0.1) if current_rr > 0 else 1
            
            # Сравниваем confirmation
            report_conf = set([c.strip().upper() for c in str(report.confirmation or "").split("+") if c.strip()])
            conf_similarity = len(current_conf_set & report_conf) / max(len(current_conf_set | report_conf), 1)
            
            # Вычисляем общую схожесть
            matches = sum([strategy_match, trading_type_match, direction_match, trend_match])
            similarity_score = (matches / 4) * 0.6 + (1 - min(rr_diff, 1)) * 0.2 + conf_similarity * 0.2
            
            if similarity_score >= (1 - similarity_threshold):
                similar_reports.append(report)
        
        if not similar_reports:
            return None, 0, "low"
        
        # Вычисляем вероятность успеха
        successful = sum(1 for r in similar_reports if r.success)
        success_probability = (successful / len(similar_reports)) * 100
        
        # Определяем уровень уверенности (возвращаем ключи для перевода)
        if len(similar_reports) >= 20:
            confidence = "high"
        elif len(similar_reports) >= 10:
            confidence = "medium"
        else:
            confidence = "low"
        
        return success_probability, len(similar_reports), confidence
    
    except Exception as e:
        print(f"⚠️ Ошибка в predict_ml_success: {e}")
        traceback.print_exc()
        return None, 0, "low"

def run_analysis(symbol, timeframe=None, strategy="Сбалансированная", trading_type="Дейтрейдинг",
                 capital=10000, risk=0.01, range_days=None, confirmation=None, min_reliability=50, 
                 enable_forecast=False, enable_backtest=False, backtest_days=None, enable_ml=False, 
                 historical_reports=None, enable_trailing=False, trailing_percent=0.5, spread=0.0, language="ru"):
    try:
        report_text = ""  # ✅ Добавь эту строку прямо тут
        if timeframe is None:
            timeframe = DEFAULT_TIMEFRAMES.get(trading_type, "1d")
        if range_days is None:
            range_days = TRADING_HISTORY_DAYS.get(trading_type, 30)

        df = fetch_ohlcv(symbol, timeframe, history_days=range_days)
        if df.empty:
            raise ValueError("Пустой DataFrame: нет исторических данных")

        df = add_indicators(df)
        df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
        df["BB_middle"] = df["Close"].rolling(20).mean()
        df["BB_std"] = df["Close"].rolling(20).std()
        df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
        df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
        df["ADX"] = compute_adx(df).fillna(0)

        # Отбираем строки с валидными Close и ATR_14 (ATR требует минимум 14 строк данных)
        df_valid = df.dropna(subset=["Close", "ATR_14"])
        if df_valid.empty:
            raise ValueError(f"Недостаточно данных для расчёта ATR. Требуется минимум 14 строк исторических данных. Получено: {len(df)} строк.")
        
        latest = df_valid.iloc[-1]
        strat = STRATEGIES.get(strategy, STRATEGIES["Сбалансированная"])
        atr = latest.get("ATR_14", np.nan)
        current_price = latest.get("Close", 0)
        
        # ✅ FALLBACK для ATR: если ATR нулевой или слишком мал, используем минимальный ATR (0.1% от цены)
        if pd.isna(atr) or atr == 0 or atr < current_price * 0.001:
            atr = current_price * 0.001  # Минимальный ATR = 0.1% от цены
        
        ema20, ema50, ema200 = latest["EMA_20"], latest["EMA_50"], latest["EMA_200"]
        
        # ✅ Передаем ADX и reliability_rating для возможности увеличения риска
        adx = latest.get("ADX", 0)
        prev_row = df_valid.iloc[-2] if len(df_valid) > 1 else None
        
        # Обработка confirmation для user_selected (должно быть определено до использования)
        conf = confirmation
        user_selected = []
        if isinstance(conf, str):
            conf_str = conf.strip()
            if conf_str.upper() in ("NONE", "", "N/A"):
                user_selected = []
            elif conf_str.upper() == "ALL":
                user_selected = ["ALL"]
            else:
                user_selected = [s.strip().upper() for s in conf_str.split("+") if s.strip()]
        elif isinstance(conf, (list, tuple)):
            user_selected = [str(c).strip().upper() for c in conf if str(c).strip()]
        elif conf is not None:
            user_selected = [str(conf).strip().upper()]
        
        user_confirmation_result, passed_count, total_count, reliability_rating = check_confirmations(latest, user_selected, prev_row=prev_row, language=language)
        risk_adj = dynamic_risk(risk, latest["RSI_14"], latest["Trend"], adx=adx, reliability_rating=reliability_rating)
        if risk_adj is None:
            risk_adj = risk  # Fallback на базовый риск, если dynamic_risk вернул None

        # ✅ Используем calculate_entry для согласованности с backtest
        long_entry = calculate_entry(latest, strat, "long")
        
        # ✅ ИСПРАВЛЕНО: Проверяем long_entry сразу после вычисления
        if pd.isna(long_entry) or long_entry is None or long_entry <= 0:
            print(f"⚠️ Проблема с long_entry: {long_entry}, используем fallback на current_price={current_price}")
            long_entry = current_price  # Fallback на текущую цену
        
        # ✅ ИСПРАВЛЕНО: Проверяем что long_entry не равен current_price (слишком близко)
        if abs(long_entry - current_price) < current_price * 0.0001:
            long_entry = current_price * 1.001  # Делаем немного выше текущей цены
        
        long_sl_base = long_entry - strat["atr_sl"] * atr
        long_tp_base = long_entry + strat["atr_tp"] * atr
        
        short_entry = calculate_entry(latest, strat, "short")
        
        # ✅ ИСПРАВЛЕНО: Проверяем short_entry сразу после вычисления
        if pd.isna(short_entry) or short_entry is None or short_entry <= 0:
            short_entry = current_price
        
        short_sl_base = short_entry + strat["atr_sl"] * atr
        short_tp_base = short_entry - strat["atr_tp"] * atr
        
        # ✅ Проверка минимального расстояния SL/TP (минимум 0.05% от цены для реализуемости)
        min_distance = current_price * 0.0005
        if abs(long_entry - long_sl_base) < min_distance:
            long_sl_base = long_entry - min_distance
        if abs(long_tp_base - long_entry) < min_distance:
            long_tp_base = long_entry + min_distance
        
        # ✅ Проверка минимального расстояния SL/TP для шорта
        if abs(short_sl_base - short_entry) < min_distance:
            short_sl_base = short_entry + min_distance
        if abs(short_entry - short_tp_base) < min_distance:
            short_tp_base = short_entry - min_distance
        
        # Применяем трейлинг-логику, если включена
        if enable_trailing:
            # Для лонга: стоп движется вверх на trailing_percent от прибыли
            # Например, если цена выросла на 2%, а trailing_percent = 50%, стоп будет на 1% от входа
            long_profit_potential = long_tp_base - long_entry
            long_trailing_sl = long_entry + (long_profit_potential * trailing_percent)
            long_sl = max(long_sl_base, long_trailing_sl)  # Стоп не может быть ниже базового
            
            # Для шорта: стоп движется вниз на trailing_percent от прибыли
            short_profit_potential = short_entry - short_tp_base
            short_trailing_sl = short_entry - (short_profit_potential * trailing_percent)
            short_sl = min(short_sl_base, short_trailing_sl)  # Стоп не может быть выше базового
        else:
            long_sl = long_sl_base
            short_sl = short_sl_base
        
        long_tp = long_tp_base
        short_tp = short_tp_base

        # ✅ Дополнительная проверка валидности значений перед использованием
        if pd.isna(long_entry) or long_entry is None or long_entry <= 0:
            long_entry = current_price
        if pd.isna(long_sl) or long_sl is None or long_sl <= 0:
            long_sl = long_entry * 0.99  # Fallback на 1% ниже входа
        if pd.isna(long_tp) or long_tp is None or long_tp <= 0:
            long_tp = long_entry * 1.02  # Fallback на 2% выше входа

        # То же для шорта
        if pd.isna(short_entry) or short_entry is None or short_entry <= 0:
            short_entry = current_price
        if pd.isna(short_sl) or short_sl is None or short_sl <= 0:
            short_sl = short_entry * 1.01  # Для шорта SL выше входа
        if pd.isna(short_tp) or short_tp is None or short_tp <= 0:
            short_tp = short_entry * 0.98  # Для шорта TP ниже входа

        long_units, long_dollars = position_size(capital, risk_adj, long_entry, long_sl)
        short_units, short_dollars = position_size(capital, risk_adj, short_entry, short_sl)

        # Рассчитываем R:R на основе реальных TP/SL стратегии
        rr_long = calculate_rr(long_entry, long_sl, long_tp)
        rr_short = calculate_rr(short_entry, short_sl, short_tp)

        # Формируем строку подтверждений для отчета
        t_conf = lambda key: get_report_translation(key, language)
        user_confirmation_str = t_conf("no_confirmations") if not user_selected else "+".join(user_selected)
        
        # === Фаза 1: Получение дополнительных метрик ===
        # Fear & Greed Index
        fg_result = get_fear_greed_index()
        fear_greed_value = fg_result[0] if fg_result else None
        fear_greed_classification = fg_result[1] if fg_result else "Недоступно"
        
        # Volatility Index (уже рассчитан в add_indicators)
        volatility_index = latest.get("Volatility_Index", 50.0)
        historical_volatility = latest.get("Historical_Volatility", np.nan)
        
        # Вероятности движения (передаем timeframe и trend для улучшенной точности)
        trend = latest.get("Trend", "N/A")  # Определяем trend здесь для использования в calculate_volatility_probabilities
        vol_probs = calculate_volatility_probabilities(
            df, 
            timeframe=timeframe, 
            trend=trend,
            target_moves=[0.01, 0.02, 0.05]
        )
        
        # Сводный индекс уверенности (Фаза 1: без Order Book и корреляций)
        confidence_index = calculate_confidence_index(
            reliability_rating=reliability_rating,
            fear_greed_value=fear_greed_value,
            volatility_index=volatility_index,
            order_book_imbalance=None,  # Будет добавлено в Фазе 2
            correlation_strength=None   # Будет добавлено в Фазе 2
        )
        
        # Проверка минимального рейтинга надёжности
        reliability_warning = ""
        if min_reliability and reliability_rating < min_reliability:
            t_warn = lambda key, **params: get_report_translation(key, language, **params)
            reliability_warning = f"\n{t_warn('reliability_warning', rating=f'{reliability_rating:.1f}', min=str(min_reliability))}"

        adx = latest.get("ADX", 0)
        trend = latest.get("Trend", "N/A")
        rsi = latest.get("RSI_14", np.nan)

        # ✅ Определяем функцию перевода раньше, чтобы использовать в perspective_bias и markdown
        t = lambda key, **params: get_report_translation(key, language, **params)
        t_key = lambda key: get_report_translation(key, language) if key else 'N/A'  # Упрощенная функция для ключей

        # --- Перспектива блок ---
        if adx < 20:
            perspective_bias = t("perspective_flat")
        elif 20 <= adx < 25:
            perspective_bias = t("perspective_uncertain")
        else:
            if trend == "Uptrend" and (not pd.isna(rsi)) and rsi > strat.get("rsi_filter", 50):
                perspective_bias = t("perspective_bullish")
            elif trend == "Downtrend" and (not pd.isna(rsi)) and rsi < strat.get("rsi_filter", 50):
                perspective_bias = t("perspective_bearish")
            else:
                perspective_bias = t("perspective_mixed")

        # --- Дополнительные рекомендации ---
        t_temp = lambda key, **params: get_report_translation(key, language, **params)
        rec_list = []
        if adx < 20:
            rec_list.append(t_temp("rec_market_flat"))
        if rsi < 30:
            rec_list.append(t_temp("rec_rsi_oversold"))
        elif rsi > 70:
            rec_list.append(t_temp("rec_rsi_overbought"))
        if trend == "Uptrend":
            rec_list.append(t_temp("rec_ema_bullish"))
        else:
            rec_list.append(t_temp("rec_ema_bearish"))
        if latest["Close"] < latest.get("VWMA_20", 0):
            rec_list.append(t_temp("rec_vwma_below"))
        else:
            rec_list.append(t_temp("rec_vwma_above"))
        recommendations_md = "\n".join([f"- {r}" for r in rec_list])
        
        # ✅ Свечной анализ
        t_temp = lambda key, **params: get_report_translation(key, language, **params)
        candlestick_patterns = detect_candlestick_patterns(df, lookback=10)
        candlestick_text = ""
        if candlestick_patterns:
            # Берем последние паттерны и убираем дублирование
            seen_patterns = set()
            unique_patterns = []
            for pat in reversed(candlestick_patterns):  # Идем с конца, чтобы взять последние
                pattern_name = pat['pattern']
                if pattern_name not in seen_patterns:
                    seen_patterns.add(pattern_name)
                    unique_patterns.append(pat)
                    if len(unique_patterns) >= 3:  # Берем максимум 3 уникальных паттерна
                        break
            unique_patterns.reverse()  # Возвращаем порядок
            
            if unique_patterns:
                # Формируем таблицу в едином формате
                candlestick_text = f"| {t_temp('indicator')} | {t_temp('value')} |\n|------------|----------|\n"
                # Маппинг названий паттернов на ключи
                pattern_name_map = {
                    "Doji": "doji",
                    "Inverted Hammer": "inverted_hammer",
                    "Hammer": "hammer",
                    "Shooting Star": "shooting_star",
                    "Bullish Engulfing": "bullish_engulfing",
                    "Bearish Engulfing": "bearish_engulfing"
                }
                for pat in unique_patterns:
                    emoji = "🟢" if pat["signal"] == "bullish" else "🔴" if pat["signal"] == "bearish" else "🟡"
                    # Переводим описание паттерна
                    pattern_key = f"pattern_{pattern_name_map.get(pat['pattern'], pat['pattern'].lower().replace(' ', '_'))}"
                    pattern_desc = get_report_translation(pattern_key, language, default=pat['description'])
                    candlestick_text += f"| {emoji} {pat['pattern']} | {pattern_desc} |\n"
            else:
                candlestick_text = f"- {{candlestick_not_found}}"
        else:
            candlestick_text = f"- {{candlestick_not_found}}"
        
        # ✅ Психологические уровни
        psychological_levels = find_psychological_levels(latest['Close'], count=3)
        psychological_text = ""
        if psychological_levels:
            # Сортируем от большего к меньшему
            psychological_levels_sorted = sorted(psychological_levels, reverse=True)[:7]
            # Формируем таблицу в едином формате
            psychological_text = f"| {{indicator}} | {{value}} |\n|------------|----------|\n"
            for level in psychological_levels_sorted:
                diff_pct = (level - latest['Close']) / latest['Close'] * 100
                sign = "+" if diff_pct > 0 else "-" if diff_pct < 0 else "="
                psychological_text += f"| ${safe_fmt(level)} | {sign}{abs(diff_pct):.2f}% |\n"
        
        # ✅ Сравнение с BTC/USDT
        # Используем потенциальную доходность на основе лучшего R:R
        best_rr = max(rr_long, rr_short) if rr_long and rr_short else (rr_long or rr_short or 0)
        # Оцениваем потенциальную доходность стратегии (упрощенная оценка)
        estimated_strategy_return = best_rr * 10 if best_rr > 0 else 0  # Примерная оценка
        
        btc_comparison_result = compare_with_btc(symbol, timeframe, estimated_strategy_return, df_valid, capital)
        btc_comparison_text = ""
        if btc_comparison_result:
            btc_return = btc_comparison_result.get("btc_return", 0)
            alpha = btc_comparison_result.get("alpha", 0)
            better = btc_comparison_result.get("better", "equal")
            btc_start = btc_comparison_result.get("btc_start_price", 0)
            btc_end = btc_comparison_result.get("btc_end_price", 0)
            
            better_emoji = "✅" if better == "strategy" else "⚠️" if better == "btc" else "⚖️"
            better_text_key = "strategy_better" if better == "strategy" else "btc_better" if better == "btc" else "equal"
            better_text_translated = t(better_text_key)
            
            # ✅ ИСПРАВЛЕНО: Используем функцию перевода для всех ключей
            btc_comparison_text = f"""
| {t('indicator')} | {t('value')} |
|------------|----------|
| {t('btc_return')} | {btc_return:+.2f}% |
| {t('strategy_return')} | {estimated_strategy_return:+.2f}% |
| {t('alpha')} | {alpha:+.2f}% |
| {t('btc_result')} | {better_emoji} {better_text_translated} |
| BTC/USDT {t('btc_price')} | ${btc_start:.2f} → ${btc_end:.2f} |
"""
        else:
            btc_comparison_text = f"- {{btc_unavailable}}"

        now = datetime.now(LOCAL_TZ)

        # --- Markdown отчёт ---
        # ✅ Функция перевода t уже определена выше
        
        # Определяем ключи для переводов (вместо переведенных текстов)
        confidence_text_key = "very_high_confidence" if confidence_index >= 80 else "high_confidence" if confidence_index >= 60 else "medium_confidence" if confidence_index >= 40 else "low_confidence"
        fear_greed_text_key = "extreme_fear" if fear_greed_value and fear_greed_value <= 25 else "fear" if fear_greed_value and fear_greed_value <= 45 else "neutral" if fear_greed_value and fear_greed_value <= 55 else "greed" if fear_greed_value and fear_greed_value <= 75 else "extreme_greed" if fear_greed_value else 'N/A'
        volatility_text_key = "high" if not pd.isna(historical_volatility) and historical_volatility > 50 else "medium" if not pd.isna(historical_volatility) and historical_volatility > 30 else "low" if not pd.isna(historical_volatility) else 'N/A'
        trend_text_key = "bull_market" if trend == 'Uptrend' else "bear_market"
        rsi_text_key = "oversold" if rsi < 30 else "overbought" if rsi > 70 else "neutral_zone"
        range_text_key = "within_bounds" if latest['Close'] > latest.get('BB_lower',0) and latest['Close'] < latest.get('BB_upper',0) else "out_of_bounds"
        vwma_text_key = "upward_momentum" if latest['Close'] > latest.get('VWMA_20',0) else "downward_momentum"
        adx_text_key = "strong_trend" if adx >= 25 else "weak_trend" if adx < 20 else "medium_trend"
        confidence_desc_key = "very_high_confidence_desc" if confidence_index >= 80 else "high_confidence_desc" if confidence_index >= 60 else "medium_confidence_desc" if confidence_index >= 40 else "low_confidence_desc"
        market_direction_key = 'bullish' if ema50 > ema200 else 'bearish'
        direction_key_value = 'long_direction' if trend == 'Uptrend' else 'short_direction'
        # Вычисляем ключ направления рынка для markdown
        market_direction_key_value = 'bullish' if ema50 > ema200 else 'bearish'
        report_md = f"""=== {{report_title}} {symbol} ===  
{{generated}} {now.strftime('%Y-%m-%d %H:%M:%S (%Z)')}  
{{current_market}} {{{{market_direction_key_value}}}}

### {{summary_title}}
| {{indicator}} | {{value}} | {{interpretation}} |
|------------|-----------|----------------|
| **{{indicator_close}}** | {safe_fmt(latest['Close'])} | {{current_price}} |
| **{{indicator_ema}}** | {safe_fmt(ema20)} / {safe_fmt(ema50)} / {safe_fmt(ema200)} | {{moving_direction}} |
| **{{indicator_rsi}}** | {safe_fmt(latest['RSI_14'])} | {latest['RSI_14']:.2f} |
| **{{indicator_atr}}** | {safe_fmt(atr)} | {{avg_volatility}} |
| **{{indicator_trend}}** | {latest['Trend']} | {{trend_text_key}} |
| **{{indicator_vwma}}** | {safe_fmt(latest.get('VWMA_20', np.nan))} | {latest.get('VWMA_20', np.nan):.2f} |
| **{{indicator_adx}}** | {safe_fmt(latest.get('ADX', np.nan))} | {adx:.2f} |
| **{{user_confirmations}}** | {user_confirmation_str} | {{result}} {user_confirmation_result} |
| **{{reliability_rating}}** | {reliability_rating:.1f}% ({passed_count}/{total_count}) | {'⭐⭐⭐⭐⭐' if reliability_rating >= 80 else '⭐⭐⭐⭐' if reliability_rating >= 60 else '⭐⭐⭐' if reliability_rating >= 40 else '⭐⭐' if reliability_rating >= 20 else '⭐'} |
| **{{confidence_index}}** | {confidence_index:.1f}% | {{confidence_text_key}} |
| **😨 Fear & Greed Index** | {fear_greed_value if fear_greed_value is not None else 'N/A'} ({fear_greed_classification}) | {{fear_greed_text_key}} |
| **📈 {{historical_volatility}}** | {safe_fmt(historical_volatility)}% | {{volatility_text_key}} |

### {{strategy_title}}
- {{trading_type_label}} {get_report_translation("trading_type_" + TRADING_TYPE_MAP.get(trading_type, trading_type.lower().replace(' ', '_')), language, default=trading_type)}
- {{strategy_label}} {get_report_translation("strategy_" + STRATEGY_MAP.get(strategy, strategy.lower().replace(' ', '_')), language, default=strategy)}
- {{capital_label}} ${capital:,.2f}
- {{dynamic_risk}} {(risk_adj*100 if risk_adj is not None else risk*100):.2f}% ({{base_risk}} {risk*100:.2f}%)
- {{confirmation_type}} {user_confirmation_str}

### {{levels_title}}
| {{parameter}} | **{{long}}** | **{{short}}** |
|-----------|-----------|-----------|
| {{trigger_buy}} / {{trigger_sell}} | {safe_fmt(long_entry) if long_entry is not None and not pd.isna(long_entry) else safe_fmt(current_price)} | {safe_fmt(short_entry) if short_entry is not None and not pd.isna(short_entry) else safe_fmt(current_price)} |
| {{stop_loss}} | {safe_fmt(long_sl) if long_sl is not None and not pd.isna(long_sl) else 'N/A'} | {safe_fmt(short_sl) if short_sl is not None and not pd.isna(short_sl) else 'N/A'} |
| {{take_profit}} | {safe_fmt(long_tp) if long_tp is not None and not pd.isna(long_tp) else 'N/A'} | {safe_fmt(short_tp) if short_tp is not None and not pd.isna(short_tp) else 'N/A'} |
| {{distance}} | {(abs(long_entry - long_sl) if long_entry is not None and long_sl is not None and not pd.isna(long_entry) and not pd.isna(long_sl) else 0):.2f} / {(abs(long_tp - long_entry) if long_tp is not None and long_entry is not None and not pd.isna(long_tp) and not pd.isna(long_entry) else 0):.2f} | {(abs(short_sl - short_entry) if short_sl is not None and short_entry is not None and not pd.isna(short_sl) and not pd.isna(short_entry) else 0):.2f} / {(abs(short_entry - short_tp) if short_entry is not None and short_tp is not None and not pd.isna(short_entry) and not pd.isna(short_tp) else 0):.2f} |
| {{position_size}} | {(long_units if long_units is not None and not pd.isna(long_units) else 0):.6f} units ≈ ${(long_dollars if long_dollars is not None and not pd.isna(long_dollars) else 0):,.2f} | {(short_units if short_units is not None and not pd.isna(short_units) else 0):.6f} units ≈ ${(short_dollars if short_dollars is not None and not pd.isna(short_dollars) else 0):,.2f} |

### {{risk_reward_ratio_title}}
- **{{risk_reward_long}}** {rr_long:.2f}
- **{{risk_reward_short}}** {rr_short:.2f}

### {{psychological_levels_title}}
{{psychological_levels_desc}}

{psychological_text if psychological_text else "- {{psychological_levels_not_found}}"}

### {{perspective_title}}
- {{more_perspective}} {get_report_translation(direction_key_value, language)}  
- {{trend}} {get_report_translation(trend_text_key, language)}  
- {{rsi_label}} {get_report_translation(rsi_text_key, language)}  
- {{range_label}} {get_report_translation(range_text_key, language)}  
- {{vwma_label}} {get_report_translation(vwma_text_key, language)}  
- {{adx_label}} {get_report_translation(adx_text_key, language)}  

### {{recommendations_title}}
{recommendations_md}
{reliability_warning}

### {{candlestick_title}}
{{candlestick_desc}}

**{{candlestick_interpretation_title}}**
{{candlestick_interpretation_text}}

{candlestick_text if candlestick_text else "- {{candlestick_not_found}}"}

### {{btc_comparison_title}}
{btc_comparison_text}

### {{additional_metrics_title}}
**{{price_movement_probabilities}}**
- {{probability_up_1}} {vol_probs.get(0.01, 0):.1f}%
- {{probability_up_2}} {vol_probs.get(0.02, 0):.1f}%
- {{probability_up_5}} {vol_probs.get(0.05, 0):.1f}%

**{{confidence_interpretation}} ({confidence_index:.1f}%):**
{{confidence_desc_key}}

"""

                # --- График с уровнями входа/выхода ---
        df_plot = df.tail(120)
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(df_plot.index, df_plot["Close"], label="Close", lw=1.5)
        ax.plot(df_plot.index, df_plot["EMA_20"], label="EMA20", alpha=0.7)
        ax.plot(df_plot.index, df_plot["EMA_50"], label="EMA50", alpha=0.7)
        ax.plot(df_plot.index, df_plot["EMA_200"], label="EMA200", alpha=0.7)

        # ✅ Используем переводы для меток графика
        t_chart = lambda key: get_report_translation(key, language, default=key)
        ax.axhline(latest["Close"], color="cyan", lw=1, linestyle="--", label=t_chart("current_price"))

        preferred_side = "LONG" if trend == "Uptrend" else "SHORT"
        preferred_side_text = t_chart("long") if preferred_side == "LONG" else t_chart("short")

        if preferred_side == "LONG":
            ax.axhline(long_entry, color="lime", lw=1.5, linestyle="--", label=t_chart("chart_entry"))
            ax.axhline(long_tp, color="gold", lw=1.5, linestyle="--", label=t_chart("chart_take_profit"))
            ax.axhline(long_sl, color="red", lw=1.5, linestyle="--", label=t_chart("chart_stop_loss"))
        else:
            ax.axhline(short_entry, color="orange", lw=1.5, linestyle="--", label=t_chart("chart_entry"))
            ax.axhline(short_tp, color="gold", lw=1.5, linestyle="--", label=t_chart("chart_take_profit"))
            ax.axhline(short_sl, color="red", lw=1.5, linestyle="--", label=t_chart("chart_stop_loss"))

        ax.legend(loc="upper left", fontsize=8)
        ax.grid(True, alpha=0.3)
        # ✅ Переводим стратегию и тип торговли для заголовка
        strategy_translated = get_report_translation("strategy_" + STRATEGY_MAP.get(strategy, strategy.lower().replace(' ', '_')), language, default=strategy)
        trading_type_translated = get_report_translation("trading_type_" + TRADING_TYPE_MAP.get(trading_type, trading_type.lower().replace(' ', '_')), language, default=trading_type)
        ax.set_title(f"{symbol} — {strategy_translated} ({trading_type_translated}) [{preferred_side_text}]")

        buf_chart = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf_chart, format="png", bbox_inches="tight", dpi=90)
        buf_chart.seek(0)
        plt.close(fig)



        # --- Excel ---
        df_excel = df.copy()
        df_excel.index = df_excel.index.tz_localize(None)
        buf_excel = io.BytesIO()
        df_excel.to_excel(buf_excel)
        buf_excel.seek(0)

        # Определяем направление и цены для новой таблицы
        # Используем реальные TP/SL из стратегии, а не пересчитываем из R:R
        direction = "long" if trend == "Uptrend" else "short"
        entry_price = long_entry if direction == "long" else short_entry
        stop_loss = long_sl if direction == "long" else short_sl
        take_profit = long_tp if direction == "long" else short_tp
        exit_price = take_profit
        rr = rr_long if direction == "long" else rr_short

        # Размер позиции уже считан ранее с учётом risk_adj
        position_units = long_units if direction == "long" else short_units
        position_dollars = long_dollars if direction == "long" else short_dollars

        # ML-прогноз вероятности успеха (если включен)
        ml_text = ""
        if enable_ml and historical_reports:
            current_params = {
                "strategy": strategy,
                "trading_type": trading_type,
                "direction": direction,
                "trend": trend,
                "rr_long": rr_long,
                "rr_short": rr_short,
                "confirmation": confirmation
            }
            ml_prob, ml_cases, ml_confidence = predict_ml_success(current_params, historical_reports)
            if ml_prob is not None and ml_cases > 0:
                # Переводим уровень уверенности (ml_confidence уже ключ: "high", "medium", "low")
                confidence_key = f"confidence_{ml_confidence}" if ml_confidence in ["high", "medium", "low"] else "confidence_low"
                confidence_translated = get_report_translation(confidence_key, language, default=ml_confidence)
                
                ml_text = (
                    f"\n### {t('ml_forecast_title')}\n"
                    f"{t('ml_forecast_analysis')}\n"
                    f"- {t('ml_forecast_success_prob')} {ml_prob:.1f}%\n"
                    f"- {t('ml_forecast_similar_cases')} {ml_cases}\n"
                    f"- {t('ml_forecast_confidence')} {confidence_translated}\n"
                )

        # Бэктестинг стратегии (если включен)
        backtest_text = ""
        if enable_backtest:
            # Используем расширенный период для бэктеста
            backtest_range = backtest_days if backtest_days else range_days * 2  # Удваиваем период для бэктеста
            if backtest_range > range_days:
                # Загружаем дополнительные данные для бэктеста
                df_backtest = fetch_ohlcv(symbol, timeframe, history_days=backtest_range)
                if not df_backtest.empty and len(df_backtest) > 100:
                    df_backtest = add_indicators(df_backtest)
                    df_backtest["VWMA_20"] = (df_backtest["Close"] * df_backtest["Volume"]).rolling(20).sum() / df_backtest["Volume"].rolling(20).sum()
                    df_backtest["BB_middle"] = df_backtest["Close"].rolling(20).mean()
                    df_backtest["BB_std"] = df_backtest["Close"].rolling(20).std()
                    df_backtest["BB_upper"] = df_backtest["BB_middle"] + 2 * df_backtest["BB_std"]
                    df_backtest["BB_lower"] = df_backtest["BB_middle"] - 2 * df_backtest["BB_std"]
                    df_backtest["ADX"] = compute_adx(df_backtest).fillna(0)
                    df_backtest["Trend"] = np.where(df_backtest["EMA_50"] > df_backtest["EMA_200"], "Uptrend", "Downtrend")
                else:
                    df_backtest = df  # Используем текущие данные
            else:
                df_backtest = df
            
            backtest_result = backtest_strategy(df_backtest, strategy, trading_type, confirmation, capital, risk, spread=spread)
            if backtest_result:
                t_bt = lambda key: get_report_translation(key, language)
                backtest_text = (
                    f"\n### 📈 {t_bt('backtest_results_title')} ({t_bt('backtest_last_days').format(days=backtest_range)})\n"
                    f"[DIVIDER]\n"
                    f"| {t_bt('indicator')} | {t_bt('value')} |\n"
                    f"|------------|----------|\n"
                    f"| {t_bt('backtest_total_trades')} | {backtest_result['total_trades']} |\n"
                    f"| {t_bt('backtest_winning_trades')} | {backtest_result['winning_trades']} |\n"
                    f"| {t_bt('backtest_losing_trades')} | {backtest_result['losing_trades']} |\n"
                    f"| {t_bt('backtest_win_rate')} | {backtest_result['win_rate']:.1f}% |\n"
                    f"| {t_bt('backtest_total_profit')} | {backtest_result['total_profit_pct']:+.2f}% |\n"
                    f"| {t_bt('backtest_max_drawdown')} | {backtest_result['max_drawdown']:.2f}% |\n"
                    f"| {t_bt('backtest_avg_rr')} | {backtest_result['avg_rr']:.2f} |\n"
                    f"| {t_bt('backtest_final_capital')} | ${backtest_result['final_capital']:,.2f} |\n"
                    f"[BACKTEST_EXPLANATION]\n"
                )
        
        # Прогноз риск/доход на основе истории (если включен)
        forecast_text = ""
        if enable_forecast:
            # ✅ Передаем strategy вместо entry_price, stop_loss, take_profit
            # forecast_risk_reward теперь пересчитывает SL/TP для каждой исторической ситуации
            expected_profit, success_prob, risk_range, similar_cases = forecast_risk_reward(
                df, latest, strategy, direction
            )
            if expected_profit is not None and similar_cases > 0:
                t_fc = lambda key, **params: get_report_translation(key, language, **params)
                forecast_text = (
                    f"\n### {t_fc('forecast_title')}\n"
                    f"{t_fc('forecast_analysis', cases=similar_cases)}\n"
                    f"{t_fc('forecast_success_prob')} {success_prob:.1f}%\n"
                    f"{t_fc('forecast_expected_profit')} {expected_profit:+.2f}%\n"
                    f"{t_fc('forecast_range', min=f'{risk_range[0]:+.2f}', max=f'{risk_range[1]:+.2f}')}\n"
                    f"{t_fc('forecast_note')}\n"
                )

        # Проверяем, что rr определен (уже определен выше в строке 2425)
        if rr is None or pd.isna(rr):
            if entry_price and stop_loss and take_profit:
                rr = calculate_rr(entry_price, stop_loss, take_profit)
            else:
                rr = 0.0

        # Текст блока «Управление позицией»
        t_mg = lambda key, **params: get_report_translation(key, language, **params)
        asset_name = symbol.split('/')[0] if '/' in symbol else 'актива'
        management_text = (
            f"\n{t_mg('position_management_title')}\n"
            f"{t_mg('position_stop_loss')} {stop_loss:.2f}\n"
            f"{t_mg('position_take_profit')} {take_profit:.2f}\n"
            f"{t_mg('position_risk_reward')} {rr:.2f}\n"
            f"{t_mg('position_size_label')} {position_units:.6f} units (≈ ${position_dollars:,.2f})\n"
            f"{t_mg('position_explanation', asset=asset_name, dollars=f'{position_dollars:,.2f}')}\n"
        )
        # Вставляем блоки перед разделом «Дополнительные рекомендации»
        insertion_key = "### 💡 Дополнительные рекомендации"
        blocks_to_insert = management_text
        if backtest_text:
            blocks_to_insert = backtest_text + "\n" + blocks_to_insert
        if forecast_text:
            blocks_to_insert = forecast_text + "\n" + blocks_to_insert
        if ml_text:
            blocks_to_insert = ml_text + "\n" + blocks_to_insert
        
        # Проверяем, есть ли ключ в report_md
        if insertion_key in report_md:
            full_report = report_md.replace(insertion_key, blocks_to_insert + "\n\n" + insertion_key)
        else:
            # Если ключа нет, ищем любой раздел с рекомендациями или добавляем в конец
            import re
            # Ищем раздел с рекомендациями (может быть с разными эмодзи)
            pattern = r'(###\s*💡[^\n]*)'
            if re.search(pattern, report_md):
                full_report = re.sub(pattern, blocks_to_insert + "\n\n" + r'\1', report_md, count=1)
            else:
                # Если не нашли, добавляем в конец перед последним разделом или просто в конец
                full_report = report_md + "\n\n" + blocks_to_insert
        
        # ✅ НАДЕЖНАЯ СИСТЕМА ПЕРЕВОДОВ: Сохраняем markdown с ключами ДО перевода
        # Это позволяет перегенерировать отчет на другом языке без повторного анализа
        full_report_with_keys = full_report  # Сохраняем сырой markdown с ключами {{key}}
        
        # ✅ НОВОЕ: Генерируем отчеты на всех трех языках сразу для мгновенного переключения
        reports_by_language = {
            "ru": translate_markdown(full_report_with_keys, "ru"),
            "en": translate_markdown(full_report_with_keys, "en"),
            "uk": translate_markdown(full_report_with_keys, "uk")
        }
        
        # ✅ ГАРАНТИРОВАННАЯ ЗАМЕНА ВСЕХ КЛЮЧЕЙ НА ПЕРЕВОДЫ НА СЕРВЕРЕ
        # Это гарантирует 100% перевод всех {{key}} перед отправкой на клиент
        full_report = translate_markdown(full_report, language)
        
        # ✅ ФАЗА 2: Добавляем RSI в возврат для использования в app.py
        rsi_value = latest.get("RSI_14", 50.0)  # Fallback на 50, если RSI не вычислен
        
        return (
            reports_by_language,      # ✅ Словарь с отчетами на всех языках {"ru": "...", "en": "...", "uk": "..."}
            full_report_with_keys,    # Сырой markdown с ключами для перегенерации (для совместимости)
            buf_chart,
            buf_excel,
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
            rsi_value  # ✅ Добавлен RSI
        )


    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка в run_analysis:", e)
        print(tb)
        raise

