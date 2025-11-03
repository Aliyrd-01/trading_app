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

LOCAL_TZ = ZoneInfo("Europe/Kyiv")
exchange = ccxt.binance({"enableRateLimit": True, "timeout": 20000})

# --- Конфигурация (твои словари) ---
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

# === вспомогательные (как в твоём оригинале) ===
def safe_fmt(x):
    try:
        return f"{float(x):,.2f}"
    except:
        return "N/A"

def fetch_ohlcv(symbol, timeframe, history_days=30):
    since_dt = datetime.utcnow() - timedelta(days=history_days)
    since_ms = int(since_dt.timestamp() * 1000)
    all_bars = []
    now_ms = int(datetime.utcnow().timestamp() * 1000)

    while True:
        try:
            chunk = exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since_ms, limit=1000)
        except Exception as e:
            print("⚠️ Ошибка fetch_ohlcv:", e)
            raise
        if not chunk:
            break
        all_bars.extend(chunk)
        since_ms = chunk[-1][0] + 1
        if len(chunk) < 1000 or since_ms >= now_ms:
            break

    if not all_bars:
        return pd.DataFrame()  # пустой DF — обработаем выше

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
        # защитимся от деления на ноль
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

def interpret_indicator(name, value, df_row):
    # same as original; keep it
    if name == "RSI_14":
        if value > 70:
            return "Перекупленность — возможна коррекция"
        elif value < 30:
            return "Перепроданность — возможен отскок"
        else:
            return "Нейтральная зона"
    elif name == "ADX":
        return "Сильный тренд" if value > 25 else "Флет или слабый тренд"
    elif name == "Trend":
        return "Бычий рынок" if df_row["Trend"] == "Uptrend" else "Медвежий рынок"
    elif name == "BB":
        if "BB_upper" in df_row and df_row["Close"] >= df_row["BB_upper"]:
            return "Цена у верхней границы — риск коррекции"
        elif "BB_lower" in df_row and df_row["Close"] <= df_row["BB_lower"]:
            return "Цена у нижней границы — возможен отскок"
        else:
            return "В пределах диапазона"
    elif name == "VWMA":
        if "VWMA_20" in df_row and not pd.isna(df_row["VWMA_20"]):
            return "Цена выше VWMA — восходящий импульс" if df_row["Close"] > df_row["VWMA_20"] else "Цена ниже VWMA — давление продавцов"
        return "-"
    return "-"

def calc_confirmation_type(row):
    adx = row.get("ADX", 0)
    rsi = row.get("RSI_14", 50)
    macd = row.get("MACD", 0)
    signal = row.get("Signal_Line", 0)
    close = row.get("Close", 0)
    vwma = row.get("VWMA_20", 0)

    try:
        if adx > 25 and close > vwma and rsi > 50 and macd > signal:
            return "Все фильтры подтверждены"
        elif adx > 25 and close > vwma:
            return "EMA + ADX + VWMA"
        elif rsi > 50 and macd > signal:
            return "RSI + MACD"
        elif close > vwma:
            return "EMA + VWMA"
        else:
            return "Нет подтверждения"
    except Exception:
        return "Ошибка в подтверждении"

def check_confirmations(row, selected):
    # robust version (same logic as final you approved)
    if not selected:
        return "Нет выбранных подтверждений", 0, 0

    if isinstance(selected, str):
        if selected.upper() in ("NONE", ""):
            return "Без фильтров", 0, 0
        selected_list = [s.strip() for s in selected.split("+") if s.strip()]
    elif isinstance(selected, (list, tuple)):
        selected_list = [str(s).strip() for s in selected if str(s).strip()]
    else:
        selected_list = [str(selected)]

    total = len(selected_list)
    score = 0
    for s in selected_list:
        s_up = s.upper()
        if s_up == "RSI":
            if row["RSI_14"] > 50:
                score += 1
        elif s_up == "MACD":
            if row["MACD"] > row["Signal_Line"]:
                score += 1
        elif s_up == "ADX":
            if row["ADX"] > 25:
                score += 1
        elif s_up == "VWMA":
            if row["Close"] > row.get("VWMA_20", 0):
                score += 1
        elif s_up == "EMA":
            if row["EMA_50"] > row["EMA_200"]:
                score += 1
        elif s_up == "ALL":
            tmp = 0
            tmp += 1 if row["ADX"] > 25 else 0
            tmp += 1 if row["Close"] > row.get("VWMA_20", 0) else 0
            tmp += 1 if row["RSI_14"] > 50 else 0
            tmp += 1 if row["MACD"] > row["Signal_Line"] else 0
            tmp += 1 if row["EMA_50"] > row["EMA_200"] else 0
            score += tmp
            total = 5
        else:
            pass

    if total == 0:
        res = "Нет выбранных подтверждений"
    elif score >= total:
        res = "Все выбранные фильтры подтверждены"
    elif score >= max(1, int(total * 0.6)):
        res = f"Частично подтверждено ({score}/{total})"
    else:
        res = f"Нет подтверждения ({score}/{total})"
    return res, score, total

# ===== основной run_analysis с защитой =====
def run_analysis(symbol, timeframe=None, strategy="Сбалансированная", trading_type="Дейтрейдинг",
                 capital=10000, risk=0.01, range_days=None, confirmation=None):
    try:
        if timeframe is None:
            timeframe = DEFAULT_TIMEFRAMES.get(trading_type, "1d")
        if range_days is None:
            range_days = TRADING_HISTORY_DAYS.get(trading_type, 30)

        df = fetch_ohlcv(symbol, timeframe, history_days=range_days)
        if df.empty:
            raise ValueError("Пустой DataFrame: нет исторических данных (fetch_ohlcv вернул 0 баров)")

        df = add_indicators(df)

        # дополнительные индикаторы
        df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
        df["BB_middle"] = df["Close"].rolling(20).mean()
        df["BB_std"] = df["Close"].rolling(20).std()
        df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
        df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
        df["ADX"] = compute_adx(df).fillna(0)

        df["Auto_Confirmation"] = df.apply(calc_confirmation_type, axis=1)

        latest = df.dropna(subset=["Close"]).iloc[-1]
        strat = STRATEGIES.get(strategy, STRATEGIES["Сбалансированная"])
        atr = latest.get("ATR_14", np.nan)

        ema20, ema50, ema200 = latest["EMA_20"], latest["EMA_50"], latest["EMA_200"]
        risk_adj = dynamic_risk(risk, latest["RSI_14"], latest["Trend"])

        long_entry = ema50 * (1 + strat["ema_buffer"])
        long_sl = long_entry - strat["atr_sl"] * atr
        long_tp = long_entry + strat["atr_tp"] * atr
        short_entry = ema20 * (1 - strat["ema_buffer"])
        short_sl = short_entry + strat["atr_sl"] * atr
        short_tp = short_entry - strat["atr_tp"] * atr

        long_units, long_dollars = position_size(capital, risk_adj, long_entry, long_sl)
        short_units, short_dollars = position_size(capital, risk_adj, short_entry, short_sl)

        rr_long = round((long_tp - long_entry) / (long_entry - long_sl), 2) if (long_entry - long_sl) else 0
        rr_short = round((short_entry - short_tp) / (short_sl - short_entry), 2) if (short_sl - short_entry) else 0

                # ---------- ИЗМЕНЁННЫЙ БЛОК: подтверждения, перспектива, рекомендации ----------
        # Пользовательские подтверждения
        if confirmation and isinstance(confirmation, (list, tuple)) and len(confirmation) > 0:
            user_confirmation_str = ", ".join(map(str, confirmation))
            user_confirmation_result, score, total = check_confirmations(latest, confirmation)
        else:
            user_confirmation_str = "Не выбраны (использовано автоопределение)"
            user_confirmation_result = f"{latest.get('Auto_Confirmation', 'Авто-анализ')}"

        # Перспектива рынка
        adx = latest.get("ADX", 0)
        trend = latest.get("Trend", "N/A")
        rsi = latest.get("RSI_14", np.nan)

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

        # --- Динамические рекомендации ---
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
        # -------------------------------------------------------------------------

        now = datetime.now(LOCAL_TZ)

        report_md = f"""=== Аналитический отчёт по {symbol} ===  
Сгенерировано: {now.strftime('%Y-%m-%d %H:%M:%S (%Z)')}  
Текущий рынок (bias): {"Бычий" if ema50 > ema200 else "Медвежий"}

### 📈 Краткое резюме
| Показатель | Значение | Интерпретация |
|------------|-----------|----------------|
| **Close** | {safe_fmt(latest['Close'])} | Текущая цена |
| **EMA20 / EMA50 / EMA200** | {safe_fmt(ema20)} / {safe_fmt(ema50)} / {safe_fmt(ema200)} | Направление скользящих |
| **RSI(14)** | {safe_fmt(latest['RSI_14'])} | {interpret_indicator("RSI_14", latest['RSI_14'], latest)} |
| **ATR(14)** | {safe_fmt(atr)} | Средняя волатильность рынка |
| **Trend** | {latest['Trend']} | {interpret_indicator("Trend", latest['Trend'], latest)} |
| **VWMA(20)** | {safe_fmt(latest.get('VWMA_20', np.nan))} | {interpret_indicator("VWMA", latest.get('VWMA_20', np.nan), latest)} |
| **BB Upper/Lower** | {safe_fmt(latest.get('BB_upper', np.nan))} / {safe_fmt(latest.get('BB_lower', np.nan))} | {interpret_indicator("BB", None, latest)} |
| **ADX** | {safe_fmt(latest.get('ADX', np.nan))} | {interpret_indicator("ADX", latest.get('ADX', np.nan), latest)} |
| **Подтверждение входа (авто)** | {latest['Auto_Confirmation']} | Автоматический анализ индикаторов |
| **Выбранные подтверждения (пользователь)** | {user_confirmation_str} | Результат: {user_confirmation_result} |

### ⚙️ Стратегия
- Тип торговли: {trading_type}
- Стратегия: {strategy}
- Капитал: ${capital:,.2f}
- **Динамический риск:** {risk_adj*100:.2f}% (базовый {risk*100:.2f}%)
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
- {perspective_bias}
- Тренд: {trend}
- {interpret_indicator("RSI_14", latest['RSI_14'], latest)}
- {interpret_indicator("BB", None, latest)}
- {interpret_indicator("VWMA", latest.get('VWMA_20', np.nan), latest)}
- {interpret_indicator("ADX", latest.get('ADX', np.nan), latest)}

### 💡 Дополнительные рекомендации
{recommendations_md}

=== Конец отчёта ===
"""


        # --- График ---
        df_plot = df.tail(120)
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(df_plot.index, df_plot["Close"], label="Close", lw=1.5)
        ax.plot(df_plot.index, df_plot["EMA_20"], label="EMA20")
        ax.plot(df_plot.index, df_plot["EMA_50"], label="EMA50")
        ax.plot(df_plot.index, df_plot["EMA_200"], label="EMA200")
        ax.legend()
        ax.grid(True)
        ax.set_title(f"{symbol} — {strategy} ({trading_type})")

        buf_chart = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf_chart, format="png")
        buf_chart.seek(0)
        plt.close(fig)

        # --- Excel ---
        df_excel = df.copy()
        df_excel.index = df_excel.index.tz_localize(None)
        buf_excel = io.BytesIO()
        df_excel.to_excel(buf_excel)
        buf_excel.seek(0)

        return report_md, buf_chart, buf_excel

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка в run_analysis:", e)
        print(tb)
        # Пробрасываем исключение дальше — app.py поймает и вернёт в ответе
        raise
