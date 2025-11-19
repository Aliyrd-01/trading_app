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

# === вспомогательные функции ===
def safe_fmt(x):
    try:
        return f"{float(x):,.2f}"
    except:
        return "N/A"

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

def calculate_volatility_probabilities(df, target_moves=[0.01, 0.02, 0.05]):
    """Рассчитывает вероятности движения цены на заданные проценты."""
    if len(df) < 20:
        return {move: 0.0 for move in target_moves}
    
    latest = df.iloc[-1]
    volatility = latest.get("Historical_Volatility", 0) / 100
    
    if volatility <= 0:
        return {move: 0.0 for move in target_moves}
    
    probabilities = {}
    for move in target_moves:
        prob_up = 1 - norm.cdf(move, 0, volatility)
        probabilities[move] = prob_up * 100
    return probabilities

def calculate_confidence_index(reliability_rating, fear_greed_value=None, volatility_index=None, 
                                order_book_imbalance=None, correlation_strength=None):
    """Рассчитывает сводный индекс уверенности (0-100%)."""
    fg_normalized = fear_greed_value if fear_greed_value is not None else 50
    vol_normalized = volatility_index if volatility_index is not None else 50
    
    base_components = {
        "reliability": reliability_rating * 0.3,
        "fear_greed": fg_normalized * 0.05,
        "volatility": vol_normalized * 0.05,
    }
    
    has_orderbook = order_book_imbalance is not None
    has_correlation = correlation_strength is not None
    
    if has_orderbook and has_correlation:
        base_components["orderbook"] = order_book_imbalance * 0.1
        base_components["correlation"] = correlation_strength * 0.1
        indicator_weight = 0.4
    elif has_orderbook:
        base_components["orderbook"] = order_book_imbalance * 0.1
        indicator_weight = 0.5
    elif has_correlation:
        base_components["correlation"] = correlation_strength * 0.1
        indicator_weight = 0.5
    else:
        indicator_weight = 0.6
    
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
            print(f"⚠️ Ошибка fetch_ohlcv для {symbol} с timeframe {timeframe}:", e)
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
    returns = df["Close"].pct_change()
    df["Historical_Volatility"] = returns.rolling(window=20).std() * np.sqrt(252) * 100  # Годовая волатильность в %
    
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

def dynamic_risk(risk_pct, rsi, trend):
    if pd.isna(rsi):
        return risk_pct
    if rsi < 45 or trend == "Downtrend":
        return risk_pct * 0.7
    elif rsi > 60 and trend == "Uptrend":
        return risk_pct * 0.85
    else:
        return risk_pct

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

def check_confirmations(row, selected, prev_row=None):
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
    if not selected:
        return "Нет выбранных подтверждений", 0, 0, 0.0

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
        return f"Нет подтверждений ❌", 0, total, reliability_rating
    elif len(passed) == total:
        return f"Все подтверждения ✅", len(passed), total, reliability_rating
    else:
        return f"Частично подтверждено ({len(passed)}/{total}): " + \
               ", ".join([f"{i} ✅" for i in passed] + [f"{i} ❌" for i in failed]), len(passed), total, reliability_rating

def smart_combine_indicators(symbol, trading_type="Дейтрейдинг", timeframe=None):
    """
    Автоматически определяет оптимальные индикаторы под текущий режим рынка.
    Возвращает список индикаторов и причину выбора.
    
    Параметры:
    - symbol: торговый символ (например, "BTC/USDT")
    - trading_type: тип торговли (для определения дефолтного таймфрейма)
    - timeframe: конкретный таймфрейм (если None - используется дефолтный для trading_type)
    """
    try:
        if timeframe is None:
            timeframe = DEFAULT_TIMEFRAMES.get(trading_type, "1h")
        range_days = TRADING_HISTORY_DAYS.get(trading_type, 30)
        
        df = fetch_ohlcv(symbol, timeframe, history_days=range_days)
        if df.empty:
            return ["EMA", "RSI"], "Недостаточно данных"
        
        df = add_indicators(df)
        df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
        df["BB_middle"] = df["Close"].rolling(20).mean()
        df["BB_std"] = df["Close"].rolling(20).std()
        df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
        df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
        df["ADX"] = compute_adx(df).fillna(0)
        
        latest = df.dropna(subset=["Close"]).iloc[-1]
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
        
        if is_trending:
            # Трендовый рынок: используем трендовые индикаторы
            indicators.append("EMA")
            indicators.append("ADX")
            indicators.append("VWMA")
            reason_parts.append("трендовый рынок")
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
        return ["EMA", "RSI"], "Ошибка анализа"

def backtest_strategy(df, strategy, trading_type, confirmation, capital=10000, risk=0.01, commission=0.001):
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
        
        # Проходим по истории и ищем сигналы
        for i in range(100, len(df) - 1):  # Пропускаем первые 100 свечей для индикаторов
            row = df.iloc[i]
            prev_row = df.iloc[i-1] if i > 0 else None
            
            # Проверяем подтверждения
            conf_result, passed_count, total_count, _ = check_confirmations(row, user_selected, prev_row=prev_row)
            
            # Если подтверждения не пройдены, пропускаем
            if not user_selected or passed_count == 0:
                continue
            
            # Определяем направление
            trend = row.get("Trend", "Uptrend")
            direction = "long" if trend == "Uptrend" else "short"
            
            # Вычисляем уровни входа/выхода
            atr = row.get("ATR_14", np.nan)
            if pd.isna(atr) or atr == 0:
                continue
            
            ema20 = row.get("EMA_20", 0)
            ema50 = row.get("EMA_50", 0)
            ema200 = row.get("EMA_200", 0)
            
            if direction == "long":
                entry = ema50 * (1 + strat["ema_buffer"])
                stop_loss_price = entry - strat["atr_sl"] * atr
                take_profit_price = entry + strat["atr_tp"] * atr
            else:
                entry = ema20 * (1 - strat["ema_buffer"])
                stop_loss_price = entry + strat["atr_sl"] * atr
                take_profit_price = entry - strat["atr_tp"] * atr
            
            # Вычисляем размер позиции
            risk_adj = dynamic_risk(risk, row.get("RSI_14", 50), trend)
            risk_usd = current_capital * risk_adj
            sl_dist = abs(entry - stop_loss_price)
            if sl_dist <= 1e-9:
                continue
            
            units = risk_usd / sl_dist
            position_value = units * entry
            
            # Защита от отрицательного капитала
            if current_capital <= 0:
                break
            
            # Симулируем сделку - проверяем, достигнут ли TP или SL
            entry_bar = i
            exit_bar = None
            exit_price = None
            profit_pct = 0
            success = False
            
            for j in range(i + 1, min(i + 200, len(df))):  # Проверяем следующие 200 свечей
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
            if exit_price is None:
                final_row = df.iloc[min(i + 200, len(df) - 1)]
                exit_price = final_row["Close"]
                exit_bar = min(i + 200, len(df) - 1)
                if direction == "long":
                    profit_pct = ((exit_price - entry) / entry) * 100
                else:
                    profit_pct = ((entry - exit_price) / entry) * 100
                success = profit_pct > 0
            
            # Вычисляем прибыль/убыток с учётом комиссии
            # Правильный расчёт: прибыль/убыток от размера риска, а не от всей позиции
            # Если достигнут SL - теряем risk_usd, если TP - получаем risk_usd * R:R
            tp_dist = abs(take_profit_price - entry)
            sl_dist_actual = abs(entry - stop_loss_price)
            
            if success:
                # Прибыльная сделка: получаем risk_usd * R:R
                rr_actual = tp_dist / sl_dist_actual if sl_dist_actual > 0 else 0
                profit_usd = risk_usd * rr_actual - (position_value * commission * 2)
            else:
                # Убыточная сделка: теряем risk_usd
                profit_usd = -risk_usd - (position_value * commission * 2)
            
            current_capital += profit_usd
            
            # Защита от отрицательного капитала
            if current_capital < 0:
                current_capital = 0
            
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
        
        if not trades:
            return None
        
        # Вычисляем метрики
        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t["success"])
        losing_trades = total_trades - winning_trades
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Общая прибыль в процентах от начального капитала
        if capital > 0:
            total_profit_pct = ((current_capital - capital) / capital) * 100
        else:
            total_profit_pct = -100.0  # Если начальный капитал был 0
        
        # Ограничиваем минимальную прибыль до -100% (полная потеря капитала)
        if total_profit_pct < -100:
            total_profit_pct = -100.0
        
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

def forecast_risk_reward(df, latest, entry_price, stop_loss, take_profit, direction, similarity_threshold=0.15):
    """
    Прогнозирует риск/доход на основе похожих ситуаций в истории.
    
    Параметры:
    - df: DataFrame с историческими данными и индикаторами
    - latest: текущая свеча
    - entry_price, stop_loss, take_profit: уровни входа/выхода
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
                # Симулируем сделку на этом моменте
                entry = row["Close"]
                
                # Вычисляем результат сделки
                if direction == "long":
                    # Для лонга: цена должна вырасти до TP или упасть до SL
                    # Проверяем, достигнут ли TP или SL в следующих свечах
                    for j in range(i + 1, min(i + 50, len(df))):  # Проверяем следующие 50 свечей
                        future_row = df.iloc[j]
                        high = future_row["High"]
                        low = future_row["Low"]
                        
                        if high >= take_profit:
                            # TP достигнут
                            profit_pct = ((take_profit - entry) / entry) * 100
                            similar_trades.append({"profit": profit_pct, "success": True})
                            break
                        elif low <= stop_loss:
                            # SL достигнут
                            loss_pct = ((stop_loss - entry) / entry) * 100
                            similar_trades.append({"profit": loss_pct, "success": False})
                            break
                    else:
                        # Не достигнут ни TP, ни SL за 50 свечей - считаем как частичный успех/неудачу
                        final_price = df.iloc[min(i + 50, len(df) - 1)]["Close"]
                        profit_pct = ((final_price - entry) / entry) * 100
                        similar_trades.append({"profit": profit_pct, "success": profit_pct > 0})
                else:  # short
                    for j in range(i + 1, min(i + 50, len(df))):
                        future_row = df.iloc[j]
                        high = future_row["High"]
                        low = future_row["Low"]
                        
                        if low <= take_profit:
                            # TP достигнут (для шорта цена упала)
                            profit_pct = ((entry - take_profit) / entry) * 100
                            similar_trades.append({"profit": profit_pct, "success": True})
                            break
                        elif high >= stop_loss:
                            # SL достигнут
                            loss_pct = ((entry - stop_loss) / entry) * 100
                            similar_trades.append({"profit": loss_pct, "success": False})
                            break
                    else:
                        final_price = df.iloc[min(i + 50, len(df) - 1)]["Close"]
                        profit_pct = ((entry - final_price) / entry) * 100
                        similar_trades.append({"profit": profit_pct, "success": profit_pct > 0})
        
        if not similar_trades:
            return None, None, None, 0
        
        # Вычисляем статистику
        profits = [t["profit"] for t in similar_trades]
        successes = [t["success"] for t in similar_trades]
        
        expected_profit = np.mean(profits)
        success_probability = (sum(successes) / len(successes)) * 100
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
    - confidence_level: уровень уверенности (Высокий/Средний/Низкий)
    """
    try:
        if not historical_reports or len(historical_reports) < 5:
            return None, 0, "Низкий"
        
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
            return None, 0, "Низкий"
        
        # Вычисляем вероятность успеха
        successful = sum(1 for r in similar_reports if r.success)
        success_probability = (successful / len(similar_reports)) * 100
        
        # Определяем уровень уверенности
        if len(similar_reports) >= 20:
            confidence = "Высокий"
        elif len(similar_reports) >= 10:
            confidence = "Средний"
        else:
            confidence = "Низкий"
        
        return success_probability, len(similar_reports), confidence
    
    except Exception as e:
        print(f"⚠️ Ошибка в predict_ml_success: {e}")
        traceback.print_exc()
        return None, 0, "Низкий"

def run_analysis(symbol, timeframe=None, strategy="Сбалансированная", trading_type="Дейтрейдинг",
                 capital=10000, risk=0.01, range_days=None, confirmation=None, min_reliability=50, 
                 enable_forecast=False, enable_backtest=False, backtest_days=None, enable_ml=False, 
                 historical_reports=None, enable_trailing=False, trailing_percent=0.5):
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

        latest = df.dropna(subset=["Close"]).iloc[-1]
        strat = STRATEGIES.get(strategy, STRATEGIES["Сбалансированная"])
        atr = latest.get("ATR_14", np.nan)
        ema20, ema50, ema200 = latest["EMA_20"], latest["EMA_50"], latest["EMA_200"]
        risk_adj = dynamic_risk(risk, latest["RSI_14"], latest["Trend"])

        long_entry = ema50 * (1 + strat["ema_buffer"])
        long_sl_base = long_entry - strat["atr_sl"] * atr
        long_tp_base = long_entry + strat["atr_tp"] * atr
        
        short_entry = ema20 * (1 - strat["ema_buffer"])
        short_sl_base = short_entry + strat["atr_sl"] * atr
        short_tp_base = short_entry - strat["atr_tp"] * atr
        
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

        long_units, long_dollars = position_size(capital, risk_adj, long_entry, long_sl)
        short_units, short_dollars = position_size(capital, risk_adj, short_entry, short_sl)

        rr_long = dynamic_rr(long_entry, long_sl, atr, latest["ADX"], latest["Trend"])
        rr_short = dynamic_rr(short_entry, short_sl, atr, latest["ADX"], latest["Trend"])

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

        user_confirmation_str = "Нет выбранных подтверждений" if not user_selected else "+".join(user_selected)
        # передаём предыдущую свечу для BB-логики возврата
        prev = df.dropna(subset=["Close"]).iloc[-2] if len(df.dropna(subset=["Close"])) >= 2 else None
        user_confirmation_result, passed_count, total_count, reliability_rating = check_confirmations(latest, user_selected, prev_row=prev)
        
        # === Фаза 1: Получение дополнительных метрик ===
        # Fear & Greed Index
        fg_result = get_fear_greed_index()
        fear_greed_value = fg_result[0] if fg_result else None
        fear_greed_classification = fg_result[1] if fg_result else "Недоступно"
        
        # Volatility Index (уже рассчитан в add_indicators)
        volatility_index = latest.get("Volatility_Index", 50.0)
        historical_volatility = latest.get("Historical_Volatility", np.nan)
        
        # Вероятности движения
        vol_probs = calculate_volatility_probabilities(df, target_moves=[0.01, 0.02, 0.05])
        
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
            reliability_warning = f"\n⚠️ **ВНИМАНИЕ:** Рейтинг надёжности сигнала ({reliability_rating:.1f}%) ниже минимального порога ({min_reliability}%). Рекомендуется воздержаться от входа."

        adx = latest.get("ADX", 0)
        trend = latest.get("Trend", "N/A")
        rsi = latest.get("RSI_14", np.nan)

        # --- Перспектива блок ---
        if adx < 20:
            perspective_bias = "Рынок во флете ⚖️"
        elif 20 <= adx < 25:
            perspective_bias = "Тренд неопределён — формируется движение ⚖️"
        else:
            if trend == "Uptrend" and (not pd.isna(rsi)) and rsi > strat.get("rsi_filter", 50):
                perspective_bias = "Явный бычий тренд 🚀"
            elif trend == "Downtrend" and (not pd.isna(rsi)) and rsi < strat.get("rsi_filter", 50):
                perspective_bias = "Явный медвежий тренд 📉"
            else:
                perspective_bias = "Тренд выражен, но подтверждения неоднозначны 🔄"

        # --- Дополнительные рекомендации ---
        rec_list = []
        if adx < 20:
            rec_list.append("Рынок во флете — лучше воздержаться от входов.")
        if rsi < 30:
            rec_list.append("RSI < 30 — перепроданность, возможен отскок вверх.")
        elif rsi > 70:
            rec_list.append("RSI > 70 — перекупленность, возможна коррекция.")
        if trend == "Uptrend":
            rec_list.append("EMA50 выше EMA200 — общий фон бычий, лонги предпочтительнее.")
        else:
            rec_list.append("EMA50 ниже EMA200 — общий фон медвежий, рассматривать шорты осторожно.")
        if latest["Close"] < latest.get("VWMA_20", 0):
            rec_list.append("Цена ниже VWMA — давление продавцов усиливается.")
        else:
            rec_list.append("Цена выше VWMA — восходящий импульс сохраняется.")
        recommendations_md = "\n".join([f"- {r}" for r in rec_list])

        now = datetime.now(LOCAL_TZ)

        # --- Markdown отчёт ---
        report_md = f"""=== Аналитический отчёт по {symbol} ===  
Сгенерировано: {now.strftime('%Y-%m-%d %H:%M:%S (%Z)')}  
Текущий рынок (bias): {"Бычий" if ema50 > ema200 else "Медвежий"}

### 📈 Краткое резюме
| Показатель | Значение | Интерпретация |
|------------|-----------|----------------|
| **Close** | {safe_fmt(latest['Close'])} | Текущая цена |
| **EMA20 / EMA50 / EMA200** | {safe_fmt(ema20)} / {safe_fmt(ema50)} / {safe_fmt(ema200)} | Направление скользящих |
| **RSI(14)** | {safe_fmt(latest['RSI_14'])} | {latest['RSI_14']:.2f} |
| **ATR(14)** | {safe_fmt(atr)} | Средняя волатильность рынка |
| **Trend** | {latest['Trend']} | {trend} |
| **VWMA(20)** | {safe_fmt(latest.get('VWMA_20', np.nan))} | {latest.get('VWMA_20', np.nan):.2f} |
| **ADX** | {safe_fmt(latest.get('ADX', np.nan))} | {adx:.2f} |
| **Выбранные подтверждения (пользователь)** | {user_confirmation_str} | Результат: {user_confirmation_result} |
| **🎯 Рейтинг надёжности сигнала** | {reliability_rating:.1f}% ({passed_count}/{total_count}) | {'⭐⭐⭐⭐⭐' if reliability_rating >= 80 else '⭐⭐⭐⭐' if reliability_rating >= 60 else '⭐⭐⭐' if reliability_rating >= 40 else '⭐⭐' if reliability_rating >= 20 else '⭐'} |
| **📊 Сводный индекс уверенности** | {confidence_index:.1f}% | {'Очень высокая уверенность' if confidence_index >= 80 else 'Высокая уверенность' if confidence_index >= 60 else 'Средняя уверенность' if confidence_index >= 40 else 'Низкая уверенность'} |
| **😨 Fear & Greed Index** | {fear_greed_value if fear_greed_value is not None else 'N/A'} ({fear_greed_classification}) | {'Крайний страх' if fear_greed_value and fear_greed_value <= 25 else 'Страх' if fear_greed_value and fear_greed_value <= 45 else 'Нейтрально' if fear_greed_value and fear_greed_value <= 55 else 'Жадность' if fear_greed_value and fear_greed_value <= 75 else 'Крайняя жадность' if fear_greed_value else 'N/A'} |
| **📈 Историческая волатильность** | {safe_fmt(historical_volatility)}% | {'Высокая' if not pd.isna(historical_volatility) and historical_volatility > 50 else 'Средняя' if not pd.isna(historical_volatility) and historical_volatility > 30 else 'Низкая' if not pd.isna(historical_volatility) else 'N/A'} |

### ⚙️ Стратегия
- Тип торговли: {trading_type}
- Стратегия: {strategy}
- Капитал: ${capital:,.2f}
- Динамический риск: {risk_adj*100:.2f}% (базовый {risk*100:.2f}%)
- Тип подтверждения: {user_confirmation_str}

### 🎯 Уровни
**Лонг**
| Параметр | Значение | Комментарий |
|-----------|-----------|-------------|
| Триггер (buy-stop) | {safe_fmt(long_entry)} | По стратегии |
| Стоп-лосс | {safe_fmt(long_sl)} | триггер − {strat["atr_sl"]} × ATR |
| Take-profit | {safe_fmt(long_tp)} | триггер + {strat["atr_tp"]} × ATR |
| Размер позиции | {long_units:.6f} units ≈ ${long_dollars:,.2f} | Риск: {risk_adj*100:.2f}% |

**Шорт**
| Параметр | Значение | Комментарий |
|-----------|-----------|-------------|
| Триггер (sell-stop) | {safe_fmt(short_entry)} | По стратегии |
| Стоп-лосс | {safe_fmt(short_sl)} | вход + {strat["atr_sl"]} × ATR |
| Take-profit | {safe_fmt(short_tp)} | вход − {strat["atr_tp"]} × ATR |
| Размер позиции | {short_units:.6f} units ≈ ${short_dollars:,.2f} | Риск: {risk_adj*100:.2f}% |

### 📊 Соотношение риск/прибыль
| Направление | R:R |
|--------------|------|
| Лонг | {rr_long} |
| Шорт | {rr_short} |

### 💰 Перспектива
- Более перспективно: {'Лонг 🚀' if trend == 'Uptrend' else 'Шорт 📉'}  
- Тренд: {'Бычий рынок' if trend == 'Uptrend' else 'Медвежий рынок'}  
- RSI: {'Перепроданность' if rsi < 30 else 'Перекупленность' if rsi > 70 else 'Нейтральная зона'}  
- Диапазон: {'В пределах границ' if latest['Close'] > latest.get('BB_lower',0) and latest['Close'] < latest.get('BB_upper',0) else 'Выход за пределы'}  
- VWMA: {'Восходящий импульс' if latest['Close'] > latest.get('VWMA_20',0) else 'Нисходящий импульс'}  
- ADX: {'Сильный тренд' if adx >= 25 else 'Слабый тренд' if adx < 20 else 'Средний тренд'}  

### 💡 Дополнительные рекомендации
{recommendations_md}
{reliability_warning}

### 📊 Дополнительные метрики
**Вероятности движения цены:**
- Вероятность роста на 1%: {vol_probs.get(0.01, 0):.1f}%
- Вероятность роста на 2%: {vol_probs.get(0.02, 0):.1f}%
- Вероятность роста на 5%: {vol_probs.get(0.05, 0):.1f}%

**Интерпретация сводного индекса уверенности ({confidence_index:.1f}%):**
{'✅ Очень высокая уверенность в сигнале — все компоненты указывают в одном направлении' if confidence_index >= 80 else '✅ Высокая уверенность — большинство факторов подтверждают сигнал' if confidence_index >= 60 else '⚠️ Средняя уверенность — сигнал подтверждён частично, требуется осторожность' if confidence_index >= 40 else '❌ Низкая уверенность — сигнал слабый, рекомендуется воздержаться от входа'}

"""

                # --- График с уровнями входа/выхода ---
        df_plot = df.tail(120)
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(df_plot.index, df_plot["Close"], label="Close", lw=1.5)
        ax.plot(df_plot.index, df_plot["EMA_20"], label="EMA20", alpha=0.7)
        ax.plot(df_plot.index, df_plot["EMA_50"], label="EMA50", alpha=0.7)
        ax.plot(df_plot.index, df_plot["EMA_200"], label="EMA200", alpha=0.7)

        ax.axhline(latest["Close"], color="cyan", lw=1, linestyle="--", label="Текущая цена")

        preferred_side = "LONG" if trend == "Uptrend" else "SHORT"

        if preferred_side == "LONG":
            ax.axhline(long_entry, color="lime", lw=1.5, linestyle="--", label="Long Entry")
            ax.axhline(long_tp, color="gold", lw=1.5, linestyle="--", label="Take Profit")
            ax.axhline(long_sl, color="red", lw=1.5, linestyle="--", label="Stop Loss")
        else:
            ax.axhline(short_entry, color="orange", lw=1.5, linestyle="--", label="Short Entry")
            ax.axhline(short_tp, color="gold", lw=1.5, linestyle="--", label="Take Profit")
            ax.axhline(short_sl, color="red", lw=1.5, linestyle="--", label="Stop Loss")

        ax.legend(loc="upper left", fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.set_title(f"{symbol} — {strategy} ({trading_type}) [{preferred_side}]")

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
        direction = "long" if trend == "Uptrend" else "short"
        entry_price = long_entry if direction == "long" else short_entry
        # Базовая дистанция SL по ATR из стратегии (согласованно с rr)
        sl_dist = strat["atr_sl"] * atr
        rr = rr_long if direction == "long" else rr_short
        if direction == "long":
            stop_loss = entry_price - sl_dist
            take_profit = entry_price + rr * sl_dist
            exit_price = take_profit
        else:
            stop_loss = entry_price + sl_dist
            take_profit = entry_price - rr * sl_dist
            exit_price = take_profit

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
                ml_text = (
                    f"\n### 🤖 ML-прогноз вероятности успеха\n"
                    f"Анализ на основе похожих паттернов индикаторов:\n"
                    f"- 🎯 Вероятность успеха: {ml_prob:.1f}%\n"
                    f"- 📊 Похожих случаев в истории: {ml_cases}\n"
                    f"- ⚡ Уровень уверенности: {ml_confidence}\n"
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
            
            backtest_result = backtest_strategy(df_backtest, strategy, trading_type, confirmation, capital, risk)
            if backtest_result:
                backtest_text = (
                    f"\n### 📈 Результаты бэктеста (последние {backtest_range} дней)\n"
                    f"[DIVIDER]\n"
                    f"✅ Всего сделок: {backtest_result['total_trades']}\n"
                    f"✅ Прибыльных: {backtest_result['winning_trades']} (Win Rate: {backtest_result['win_rate']:.1f}%)\n"
                    f"❌ Убыточных: {backtest_result['losing_trades']}\n"
                    f"💰 Общая прибыль: {backtest_result['total_profit_pct']:+.2f}%\n"
                    f"📉 Максимальная просадка: {backtest_result['max_drawdown']:.2f}%\n"
                    f"📈 Средний R:R: {backtest_result['avg_rr']:.2f}\n"
                    f"💵 Финальный капитал: ${backtest_result['final_capital']:,.2f}\n"
                    f"\n\n**Что показывает бэктест:**\n"
                    f"- Симулирует вашу стратегию на исторических данных за последние {backtest_range} дней\n"
                    f"- Показывает, сколько сделок было бы открыто и их результаты\n"
                    f"- **Win Rate** (процент прибыльных сделок) = Прибыльные сделки / Всего сделок × 100%\n"
                    f"- Максимальная просадка — насколько капитал падал от пика (риск)\n"
                    f"- Средний R:R — среднее соотношение прибыли к риску\n"
                )
        
        # Прогноз риск/доход на основе истории (если включен)
        forecast_text = ""
        if enable_forecast:
            expected_profit, success_prob, risk_range, similar_cases = forecast_risk_reward(
                df, latest, entry_price, stop_loss, take_profit, direction
            )
            if expected_profit is not None and similar_cases > 0:
                forecast_text = (
                    f"\n### 📊 Прогноз на основе истории\n"
                    f"Анализ {similar_cases} похожих ситуаций в истории:\n"
                    f"- 🎯 Вероятность успеха: {success_prob:.1f}%\n"
                    f"- 💰 Ожидаемая прибыль: {expected_profit:+.2f}%\n"
                    f"- ⚠️ Диапазон риска: {risk_range[0]:.2f}% до {risk_range[1]:.2f}%\n"
                )

        # Текст блока «Управление позицией»
        management_text = (
            f"\n=== Управление позицией ===\n"
            f"Stop Loss: {stop_loss:.2f}\n"
            f"Take Profit: {take_profit:.2f}\n"
            f"Risk/Reward: {rr:.2f}\n"
            f"Position: {position_units:.6f} units (≈ ${position_dollars:,.2f})\n"
            f"*Пояснение: units — количество единиц актива ({symbol.split('/')[0] if '/' in symbol else 'актива'}), ${position_dollars:,.2f} — стоимость позиции в долларах*\n"
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
        
        if insertion_key in report_md:
            full_report = report_md.replace(insertion_key, blocks_to_insert + "\n\n" + insertion_key)
        else:
            full_report = report_md + blocks_to_insert
        return (
            full_report,
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
            reliability_rating
        )


    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка в run_analysis:", e)
        print(tb)
        raise

