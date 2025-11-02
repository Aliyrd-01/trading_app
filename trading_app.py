#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import ccxt
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# --- Конфигурация ---
LOCAL_TZ = ZoneInfo("Europe/Kyiv")
exchange = ccxt.binance({"enableRateLimit": True, "timeout": 20000})

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

# --- Вспомогательные функции ---
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
        chunk = exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since_ms, limit=1000)
        if not chunk:
            break
        all_bars.extend(chunk)
        since_ms = chunk[-1][0] + 1
        if len(chunk) < 1000 or since_ms >= now_ms:
            break

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
    df = df.copy()
    up_move = df['High'].diff()
    down_move = df['Low'].diff().abs()

    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0), index=df.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0), index=df.index)

    tr = pd.concat([df['High'] - df['Low'],
                    (df['High'] - df['Close'].shift()).abs(),
                    (df['Low'] - df['Close'].shift()).abs()], axis=1).max(axis=1)

    atr = tr.rolling(period).mean()
    plus_di = 100 * (plus_dm.rolling(period).sum() / atr)
    minus_di = 100 * (minus_dm.rolling(period).sum() / atr)
    dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di))
    adx = dx.rolling(period).mean()
    return adx

def dynamic_risk(risk_pct, rsi, trend):
    if rsi < 45 or trend == "Downtrend":
        return risk_pct * 0.7
    elif rsi > 60 and trend == "Uptrend":
        return risk_pct * 0.85
    else:
        return risk_pct

def position_size(capital, risk_pct, entry, stop):
    risk_usd = capital * risk_pct
    dist = abs(entry - stop)
    if dist <= 1e-9:
        return 0, 0
    units = risk_usd / dist
    dollars = units * entry
    return units, dollars

def interpret_indicator(name, value, df_row):
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
        if df_row["Close"] >= df_row["BB_upper"]:
            return "Цена у верхней границы — риск коррекции"
        elif df_row["Close"] <= df_row["BB_lower"]:
            return "Цена у нижней границы — возможен отскок"
        else:
            return "В пределах диапазона"
    elif name == "VWMA":
        return "Цена выше VWMA — восходящий импульс" if df_row["Close"] > df_row["VWMA_20"] else "Цена ниже VWMA — давление продавцов"
    return "-"

def calc_confirmation_type(row):
    adx = row["ADX"]
    rsi = row["RSI_14"]
    macd = row["MACD"]
    signal = row["Signal_Line"]
    close = row["Close"]
    vwma = row["VWMA_20"]

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

# --- Основная функция анализа ---
def run_analysis(symbol, timeframe=None, strategy="Сбалансированная", trading_type="Дейтрейдинг",
                 capital=10000, risk=0.01, range_days=None, confirmation="EMA"):

    if timeframe is None:
        timeframe = DEFAULT_TIMEFRAMES.get(trading_type, "1d")

    if range_days is None:
        range_days = TRADING_HISTORY_DAYS.get(trading_type, 30)

    df = fetch_ohlcv(symbol, timeframe, history_days=range_days)
    df = add_indicators(df)

    df["VWMA_20"] = (df["Close"] * df["Volume"]).rolling(20).sum() / df["Volume"].rolling(20).sum()
    df["BB_middle"] = df["Close"].rolling(20).mean()
    df["BB_std"] = df["Close"].rolling(20).std()
    df["BB_upper"] = df["BB_middle"] + 2 * df["BB_std"]
    df["BB_lower"] = df["BB_middle"] - 2 * df["BB_std"]
    df["ADX"] = compute_adx(df)

    df["Auto_Confirmation"] = df.apply(calc_confirmation_type, axis=1)

    latest = df.dropna(subset=["Close"]).iloc[-1]
    strat = STRATEGIES[strategy]
    atr = latest["ATR_14"]

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

    if latest['Trend'] == 'Uptrend' and latest['RSI_14'] > strat['rsi_filter']:
        perspective_bias = "Более перспективно: Лонг 🚀"
    elif latest['Trend'] == 'Downtrend' and latest['RSI_14'] < strat['rsi_filter']:
        perspective_bias = "Более перспективно: Шорт 📉"
    else:
        perspective_bias = "Рынок неопределён ⚖️"

    now = datetime.now(LOCAL_TZ)

    # --- Полный отчет ---
    report_md = f"""=== Аналитический отчёт по {symbol.split('/')[0]} ===  
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
| **VWMA(20)** | {safe_fmt(latest['VWMA_20'])} | {interpret_indicator("VWMA", latest['VWMA_20'], latest)} |
| **BB Upper/Lower** | {safe_fmt(latest['BB_upper'])} / {safe_fmt(latest['BB_lower'])} | {interpret_indicator("BB", None, latest)} |
| **ADX** | {safe_fmt(latest['ADX'])} | {interpret_indicator("ADX", latest['ADX'], latest)} |
| **Подтверждение входа (авто)** | {latest['Auto_Confirmation']} | Автоматический анализ индикаторов |

### ⚙️ Стратегия
- Тип торговли: {trading_type}
- Стратегия: {strategy}
- Капитал: ${capital:,.2f}
- **Динамический риск:** {risk_adj*100:.2f}% (базовый {risk*100:.2f}%)
- Тип подтверждения: {confirmation} / авто: {latest['Auto_Confirmation']}

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

### 💰 Перспектива
- {perspective_bias}
- Тренд: {latest['Trend']}
- {interpret_indicator("RSI_14", latest['RSI_14'], latest)}
- {interpret_indicator("BB", None, latest)}
- {interpret_indicator("VWMA", latest['VWMA_20'], latest)}
- {interpret_indicator("ADX", latest['ADX'], latest)}

### 💡 Дополнительные рекомендации
- Тренд устойчивый — допускаются сделки по направлению движения.
- RSI < 30 — перепроданность, возможен отскок вверх.
- Цена ниже VWMA — давление продавцов усиливается.
- EMA50 выше EMA200 — общий фон бычий, лонги предпочтительнее.

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
