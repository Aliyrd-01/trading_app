#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
✅ ФАЗА 2: Единый модуль расчетов для централизации бизнес-логики
Содержит функции для расчета риска, комиссий, размера позиции и P/L
"""


def dynamic_risk(risk_pct, rsi, trend, adx=None, reliability_rating=None):
    """
    Динамическая корректировка риска на основе индикаторов.
    
    Параметры:
    - risk_pct: базовый риск (0.01 = 1%)
    - rsi: значение RSI (0-100)
    - trend: тренд ("Uptrend" или "Downtrend")
    - adx: значение ADX (опционально)
    - reliability_rating: рейтинг надежности (0-100, опционально)
    
    Возвращает:
    - Скорректированный риск (float) или None при ошибке
    """
    try:
        if risk_pct is None or risk_pct <= 0:
            return None
        
        risk_adj = risk_pct
        
        # Корректировка на основе RSI
        if rsi is not None:
            if rsi > 70:  # Перекупленность
                risk_adj *= 0.7  # Уменьшаем риск на 30%
            elif rsi < 30:  # Перепроданность
                risk_adj *= 0.8  # Уменьшаем риск на 20%
            elif 40 <= rsi <= 60:  # Нейтральная зона
                risk_adj *= 1.1  # Увеличиваем риск на 10%
        
        # Корректировка на основе тренда
        if trend:
            if trend == "Uptrend":
                risk_adj *= 1.15  # Увеличиваем риск на 15% при восходящем тренде
            elif trend == "Downtrend":
                risk_adj *= 0.85  # Уменьшаем риск на 15% при нисходящем тренде
        
        # Корректировка на основе ADX (сила тренда)
        if adx is not None and adx > 0:
            if adx > 25:  # Сильный тренд
                risk_adj *= 1.1
            elif adx < 20:  # Слабый тренд
                risk_adj *= 0.9
        
        # Корректировка на основе рейтинга надежности
        if reliability_rating is not None:
            if reliability_rating >= 80:
                risk_adj *= 1.2  # Высокая надежность - увеличиваем риск
            elif reliability_rating < 50:
                risk_adj *= 0.7  # Низкая надежность - уменьшаем риск
        
        # Ограничиваем риск разумными пределами
        risk_adj = max(risk_pct * 0.5, min(risk_adj, risk_pct * 2.0))
        
        return risk_adj
    
    except Exception:
        return None


def calculate_entry(row, strat, direction):
    """
    Расчет цены входа на основе стратегии.
    
    Параметры:
    - row: строка DataFrame с индикаторами
    - strat: словарь стратегии (entry_type, ema_buffer)
    - direction: "long" или "short"
    
    Возвращает:
    - Цену входа (float)
    """
    try:
        entry_type = strat.get("entry_type", "close")
        ema_buffer = strat.get("ema_buffer", 0.0)
        
        if entry_type == "ema50":
            base_price = row.get("EMA_50", row.get("Close", 0))
        elif entry_type == "ema20":
            base_price = row.get("EMA_20", row.get("Close", 0))
        else:  # "close" или по умолчанию
            base_price = row.get("Close", 0)
        
        if direction == "long":
            entry = base_price * (1 + ema_buffer)
        else:  # short
            entry = base_price * (1 - ema_buffer)
        
        return entry if entry > 0 else row.get("Close", 0)
    
    except Exception:
        return row.get("Close", 0) if hasattr(row, 'get') else 0


def calculate_fees(position_value, commission_rate=0.002):
    """
    Расчет комиссий от стоимости позиции.
    
    Параметры:
    - position_value: стоимость позиции в USD
    - commission_rate: ставка комиссии (0.002 = 0.2% round-trip)
    
    Возвращает:
    - Сумма комиссии (float)
    """
    try:
        if position_value is None or position_value <= 0:
            return 0.0
        return position_value * commission_rate
    except Exception:
        return 0.0


def calculate_spread(position_value, spread_pct):
    """
    Расчет спреда от стоимости позиции (round-trip).
    
    Параметры:
    - position_value: стоимость позиции в USD
    - spread_pct: спред в процентах (например, 0.1 для 0.1%)
    
    Возвращает:
    - Сумма спреда (float) - применяется при входе и выходе
    """
    try:
        if position_value is None or position_value <= 0 or spread_pct is None:
            return 0.0
        if spread_pct < 0:
            return 0.0
        # Спред применяется при входе и выходе (round-trip)
        return position_value * (spread_pct / 100) * 2
    except Exception:
        return 0.0


def calculate_position_size(risk_amount, entry_price, stop_loss_price, direction):
    """
    Расчет размера позиции на основе суммы риска и расстояния до стоп-лосса.
    
    Параметры:
    - risk_amount: сумма риска в USD
    - entry_price: цена входа
    - stop_loss_price: цена стоп-лосса
    - direction: "long" или "short"
    
    Возвращает:
    - (position_units, position_value): количество единиц и стоимость позиции
    """
    try:
        if risk_amount is None or risk_amount <= 0:
            return 0.0, 0.0
        
        if entry_price is None or entry_price <= 0:
            return 0.0, 0.0
        
        if stop_loss_price is None or stop_loss_price <= 0:
            return 0.0, 0.0
        
        # Расстояние до стоп-лосса
        if direction == "long":
            sl_distance = abs(entry_price - stop_loss_price)
        else:  # short
            sl_distance = abs(stop_loss_price - entry_price)
        
        if sl_distance < 1e-9:  # Слишком маленькое расстояние
            return 0.0, 0.0
        
        # Размер позиции в единицах актива
        position_units = risk_amount / sl_distance
        
        # Стоимость позиции
        position_value = position_units * entry_price
        
        return position_units, position_value
    
    except Exception:
        return 0.0, 0.0


def calculate_profit_loss(entry_price, exit_price, position_units, direction, 
                         commission_amount=0.0, spread_amount=0.0):
    """
    Расчет прибыли/убытка с учетом комиссий и спреда.
    
    Параметры:
    - entry_price: цена входа
    - exit_price: цена выхода
    - position_units: размер позиции в единицах
    - direction: "long" или "short"
    - commission_amount: сумма комиссий
    - spread_amount: сумма спреда
    
    Возвращает:
    - (profit_loss, profit_loss_percent): прибыль в USD и процентах
    """
    try:
        if entry_price is None or entry_price <= 0:
            return None, None
        
        if exit_price is None or exit_price <= 0:
            return None, None
        
        if position_units is None or position_units <= 0:
            return None, None
        
        # Базовая прибыль/убыток
        if direction == "long":
            profit_loss = (exit_price - entry_price) * position_units
            profit_loss_percent = ((exit_price - entry_price) / entry_price) * 100
        else:  # short
            profit_loss = (entry_price - exit_price) * position_units
            profit_loss_percent = ((entry_price - exit_price) / entry_price) * 100
        
        # Вычитаем комиссии и спред
        profit_loss -= commission_amount
        profit_loss -= spread_amount
        
        return profit_loss, profit_loss_percent
    
    except Exception:
        return None, None






