// --- Модуль универсальных тултипов (не зависит от стилей родителя) ---
const ProTooltipManager = {
  tooltips: new Map(), // Хранит данные тултипов для каждого элемента
  
  create(element, message = null) {
    // Используем перевод по умолчанию, если сообщение не указано
    if (!message) {
      message = t('pro_only_tooltip');
    }
    // Проверяем, что элемент существует
    if (!element || !document.body) {
      return;
    }
    
    // Проверяем, не создан ли уже тултип
    if (this.tooltips.has(element)) {
      return;
    }
    
    // Находим родительский контейнер для привязки событий (disabled элементы не получают события)
    let eventTarget = element;
    const parent = element.parentElement;
    
    // Для toggleAdvanced используем advanced-toggle-container
    if (element.id === 'toggleAdvanced' && parent && parent.classList.contains('advanced-toggle-container')) {
      eventTarget = parent;
    }
    // Для кнопок статистики и анализа используем downloadButtons контейнер
    else if ((element.id === 'downloadStats' || element.id === 'loadStrategyAnalysis') && parent && parent.id === 'downloadButtons') {
      // Для каждой кнопки создаем индивидуальную обертку
      if (!element.parentElement.classList.contains('tooltip-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tooltip-wrapper';
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        eventTarget = wrapper;
      } else {
        eventTarget = element.parentElement;
      }
    }
    // Для других элементов создаем обертку, если элемент disabled
    else if (element.disabled || element.classList.contains('disabled-free')) {
      if (!parent.classList.contains('tooltip-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tooltip-wrapper';
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        eventTarget = wrapper;
      } else {
        eventTarget = parent;
      }
    }
    
    // Создаем тултип и добавляем в body (не зависит от opacity родителя)
    const tooltip = document.createElement('div');
    tooltip.className = 'pro-tooltip-fixed';
    tooltip.textContent = message;
    tooltip.style.cssText = 'position: fixed; background: #3a3f52; color: #fff; padding: 6px 12px; border-radius: 5px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 10000; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); visibility: hidden; left: 0; top: 0;';
    document.body.appendChild(tooltip);
    
    // Функции для показа/скрытия
    const showTooltip = () => {
      if (!element || !tooltip.parentNode) return;
      
      try {
        const rect = element.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return;
        
        // Используем фиксированные размеры для быстрого позиционирования
        const tooltipWidth = 220;
        const tooltipHeight = 32;
        
        // Позиционируем тултип над элементом по центру
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        let top = rect.top - tooltipHeight - 8;
        
        // Проверяем границы экрана
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth - 10) {
          left = window.innerWidth - tooltipWidth - 10;
        }
        if (top < 10) {
          top = rect.bottom + 8; // Показываем снизу, если не помещается сверху
        }
        
        // Устанавливаем финальную позицию и показываем
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
      } catch (e) {
        console.error('Ошибка показа тултипа:', e);
      }
    };
    
    const hideTooltip = () => {
      if (tooltip.parentNode) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.style.visibility = 'hidden';
          }
        }, 200);
      }
    };
    
    // Привязываем события к контейнеру, а не к disabled элементу
    eventTarget.addEventListener('mouseenter', showTooltip);
    eventTarget.addEventListener('mouseleave', hideTooltip);
    eventTarget.addEventListener('mousemove', showTooltip);
    
    // Сохраняем данные для удаления
    this.tooltips.set(element, {
      tooltip: tooltip,
      showTooltip: showTooltip,
      hideTooltip: hideTooltip,
      eventTarget: eventTarget
    });
  },
  
  remove(element) {
    const data = this.tooltips.get(element);
    if (data) {
      // Удаляем обработчики с правильного элемента (контейнера)
      const target = data.eventTarget || element;
      target.removeEventListener('mouseenter', data.showTooltip);
      target.removeEventListener('mouseleave', data.hideTooltip);
      target.removeEventListener('mousemove', data.showTooltip);
      
      // Удаляем тултип из DOM
      if (data.tooltip && data.tooltip.parentNode) {
        data.tooltip.remove();
      }
      
      // Удаляем обертку, если она была создана
      if (data.eventTarget && data.eventTarget.classList.contains('tooltip-wrapper')) {
        const wrapper = data.eventTarget;
        if (element.parentNode === wrapper) {
          wrapper.parentNode.insertBefore(element, wrapper);
          wrapper.remove();
        }
      }
      
      // Удаляем из Map
      this.tooltips.delete(element);
    }
  },
  
  removeAll() {
    this.tooltips.forEach((data, element) => {
      this.remove(element);
    });
  },
  
  // Обновляет текст всех тултипов при смене языка
  updateAllTooltips() {
    this.tooltips.forEach((data, element) => {
      if (data.tooltip && data.tooltip.parentNode) {
        data.tooltip.textContent = t('pro_only_tooltip');
      }
    });
  }
};

// --- Система переводов ---
let currentLanguage = localStorage.getItem('language') || 'ru';
let userPlan = null;

// ✅ НОВОЕ: Сохраняем параметры и данные последнего анализа для перегенерации при смене языка
let lastAnalysisParams = null; // Параметры последнего анализа
let lastAnalysisData = null; // Данные последнего анализа
let lastReportMarkdown = null; // Markdown отчета с ключами переводов
let lastReportsByLanguage = null; // ✅ Отчеты на всех трех языках {"ru": "...", "en": "...", "uk": "..."}
let lastReportMeta = null;

function t(key, params = {}) {
  const translation = translations[currentLanguage]?.[key] || translations['ru'][key] || key;
  if (Object.keys(params).length === 0) {
    return translation;
  }
  return translation.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
}

function updateTranslations() {
  // Обновляем тексты элементов с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'OPTION') {
      // Для option сохраняем значение, обновляем только текст
      const value = el.value;
      el.textContent = t(key);
      el.value = value;
    } else {
      el.textContent = t(key);
    }
  });
  
  // Обновляем tooltips с data-tip-key
  document.querySelectorAll('[data-tip-key]').forEach(el => {
    const tipKey = el.getAttribute('data-tip-key');
    el.setAttribute('data-tip', t(tipKey));
  });
  
  // Обновляем placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  
  // Обновляем title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });

  // Обновляем тултипы ProTooltipManager
  if (typeof ProTooltipManager !== 'undefined') {
    ProTooltipManager.updateAllTooltips();
  }
}

function parseConfirmationValue(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw || raw === 'N/A') return { mode: 'NONE', selected: [] };
  if (raw === 'ALL') return { mode: 'ALL', selected: [] };
  if (raw === 'NONE') return { mode: 'NONE', selected: [] };
  const parts = raw
    .split('+')
    .map(s => s.trim())
    .filter(Boolean);
  return { mode: 'CUSTOM', selected: parts };
}

function buildConfirmationValue(ui) {
  if (!ui) return 'NONE';
  if (ui.mode === 'ALL') return 'ALL';
  if (ui.mode === 'NONE') return 'NONE';
  const sel = (ui.selected || []).map(s => String(s).trim().toUpperCase()).filter(Boolean);
  return sel.length ? sel.join('+') : 'NONE';
}

function setupConfirmationCheckboxUi({
  hiddenInputId,
  modeRadioName,
  indicatorsContainerId,
  defaultValue = 'NONE'
}) {
  const hidden = document.getElementById(hiddenInputId);
  const container = document.getElementById(indicatorsContainerId);
  if (!hidden || !container) return null;

  const box = container.closest('.confirmation-box') || container.parentElement;
  const scope = box || document;
  const modeRadios = scope.querySelectorAll(`input[name="${modeRadioName}"]`);
  if (!modeRadios.length) return null;

  const indicatorCheckboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

  function setMode(mode) {
    modeRadios.forEach(r => {
      r.checked = String(r.value).toUpperCase() === mode;
    });

    const showIndicators = mode === 'CUSTOM' || mode === 'ALL';
    container.style.display = showIndicators ? '' : 'none';

    indicatorCheckboxes.forEach(cb => {
      if (mode === 'CUSTOM') {
        cb.disabled = false;
        return;
      }

      cb.disabled = true;

      if (mode === 'ALL') {
        cb.checked = true;
      } else {
        cb.checked = false;
      }
    });
  }

  function getUi() {
    const checkedMode = Array.from(modeRadios).find(r => r.checked);
    const mode = (checkedMode?.value || 'NONE').toUpperCase();
    const selected = indicatorCheckboxes
      .filter(cb => cb.checked)
      .map(cb => String(cb.value || '').trim().toUpperCase())
      .filter(Boolean);
    return { mode, selected };
  }

  function syncHidden() {
    const ui = getUi();
    hidden.value = buildConfirmationValue(ui);
  }

  function applyValue(value) {
    const ui = parseConfirmationValue(value);
    setMode(ui.mode);
    if (ui.mode === 'CUSTOM') {
      indicatorCheckboxes.forEach(cb => {
        const v = String(cb.value || '').trim().toUpperCase();
        cb.checked = ui.selected.includes(v);
      });
    }
    hidden.value = buildConfirmationValue(ui);
  }

  modeRadios.forEach(r => {
    r.addEventListener('change', () => {
      const m = String(r.value).toUpperCase();
      setMode(m);
      syncHidden();
    });
  });

  indicatorCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      syncHidden();
    });
  });

  applyValue(hidden.value || defaultValue);

  return { applyValue, syncHidden, setMode, getUi, hidden };
}

// ✅ НОВОЕ: Перегенерация отчетов при смене языка
async function regenerateReportsOnLanguageChange() {
  // Проверяем, есть ли уже сгенерированный отчет
  const reportText = document.getElementById('reportText');
  const result = document.getElementById('result');
  
  if (!reportText || !result || result.classList.contains('demo')) {
    return; // Нет отчета для перегенерации
  }
  
  // ✅ НОВОЕ: Если есть предсгенерированные отчеты на всех языках - просто переключаемся
  if (lastReportsByLanguage && lastReportsByLanguage[currentLanguage]) {
    console.log('✅ Переключение на предсгенерированный отчет на языке:', currentLanguage);
    reportText.innerHTML = renderReport(lastReportsByLanguage[currentLanguage], lastReportMeta);
    showToast(t('language_changed') || '✅ Язык изменен', 'success');
    return; // Мгновенное переключение без запросов к серверу
  }
  
  // ✅ Fallback: Перегенерируем отчет ПОЛНОСТЬЮ через /api/analyze с новым языком
  // Это необходимо, если предсгенерированные отчеты недоступны
  if (lastAnalysisParams) {
    console.log('🔄 Перегенерация отчета на языке:', currentLanguage, 'Параметры:', lastAnalysisParams);
    try {
      // Показываем индикатор загрузки
      const analyzeBtn = document.getElementById('analyzeBtn');
      if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = t('regenerating_report') || '🔄 Перегенерация отчета...';
      }
      
      // Отправляем запрос на перегенерацию с новым языком
      const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          ...lastAnalysisParams,
          language: currentLanguage // ✅ Передаем новый язык
      })
    });
    
      const data = await response.json();
    
    if (data.error) {
        console.warn('Ошибка перегенерации отчета:', data.error);
        if (analyzeBtn) {
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = t('analyze') || '🚀 Запустить анализ';
        }
        if (typeof showToast === 'function') {
          showToast('❌ Ошибка перегенерации: ' + data.error, 'error');
      }
      return;
    }
    
      // Обновляем отчет
    if (data.report_text) {
        // ✅ Сохраняем сырой markdown С КЛЮЧАМИ для будущих операций
        lastReportMarkdown = data.report_markdown_raw || data.report_text;
        // ✅ Сохраняем отчеты на всех языках, если они есть
        if (data.reports_by_language) {
          lastReportsByLanguage = data.reports_by_language;
        }
        reportText.innerHTML = renderReport(data.report_text, lastReportMeta);
        showToast(t('report_regenerated') || '✅ Отчет перегенерирован', 'success');
      }
      
      // ✅ Обновляем график отчета, если он есть
      if (data.chart_base64) {
        const chartImg = document.querySelector('#result img[src*="data:image"]');
        if (chartImg) {
          chartImg.src = `data:image/png;base64,${data.chart_base64}`;
        }
      }
      
      // ✅ НОВОЕ: Перегенерируем сравнение стратегий, если оно было
      if (data.backtest_all_strategies && Object.keys(data.backtest_all_strategies).length > 0) {
        console.log('✅ Перегенерируем сравнение стратегий:', Object.keys(data.backtest_all_strategies));
        displayCompareBacktest(data.backtest_all_strategies);
      } else {
        console.log('ℹ️ Сравнение стратегий не найдено в ответе (enable_backtest:', lastAnalysisParams?.enable_backtest, ')');
      }
      
      // Обновляем график и линии анализа, если они есть
      if (data.entry_price && data.stop_loss && data.take_profit && realtimeChart) {
        displaySignalLevels({
          symbol: data.symbol,
          entry_price: data.entry_price,
          stop_loss: data.stop_loss,
          take_profit: data.take_profit,
          direction: data.direction,
          enable_trailing: data.enable_trailing || false
        });
      }
      
      // Обновляем данные для экспорта
      if (data.entry_price && data.symbol) {
        window.lastAnalysisResult = {
          symbol: data.symbol,
          entry_price: data.entry_price,
          stop_loss: data.stop_loss,
          take_profit: data.take_profit,
          direction: data.direction
        };
      }
      
      // ✅ Активируем кнопку экспорта в TradingView после перегенерации
      const exportTradingViewBtn = document.getElementById('exportTradingView');
      if (exportTradingViewBtn && data.entry_price && data.symbol) {
        exportTradingViewBtn.disabled = false;
        exportTradingViewBtn.classList.remove('disabled-free');
      } else if (exportTradingViewBtn) {
        exportTradingViewBtn.disabled = true;
      }
      
      // ✅ Активируем кнопку скачивания отчета после перегенерации
      const downloadBtn = document.getElementById('downloadZip');
      if (downloadBtn && data.zip_base64) {
        downloadBtn.disabled = false;
        downloadBtn.classList.remove('disabled-free');
        // Обновляем обработчик для нового ZIP
        downloadBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
              const res = await window.pyjs.saveZipFile(data.zip_base64 || "", "analysis_report.zip");
              if (res === "ok") {
                showToast(t('toast_zip_saved'), "success");
              } else {
                showToast(t('toast_save_cancelled'), "error");
              }
              return;
            }
            const blob = base64ToBlob(data.zip_base64, "application/zip");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "analysis_report.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(t('toast_zip_downloaded'), "success");
          } catch (err) {
            console.error("Ошибка скачивания:", err);
            showToast(t('toast_save_failed'), "error");
          }
        };
      } else if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.onclick = null;
      }
      
      // ✅ Активируем кнопку скачивания статистики (если не Free план)
      const downloadStatsBtn = document.getElementById('downloadStats');
      if (downloadStatsBtn) {
        if (userPlan && userPlan !== 'free') {
          downloadStatsBtn.disabled = false;
          downloadStatsBtn.classList.remove('disabled-free');
        } else {
          downloadStatsBtn.disabled = true;
          downloadStatsBtn.classList.add('disabled-free');
        }
      }
      
      // ✅ ИСПРАВЛЕНО: Восстанавливаем текст кнопки через перевод
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = t('analyze') || '🚀 Запустить анализ';
      }
      
      // Сохраняем новые данные с обновленным языком
      lastAnalysisParams = {
        ...lastAnalysisParams,
        language: currentLanguage // Обновляем язык в параметрах
      };
      lastAnalysisData = data;
      
      // ✅ Перегенерируем анализ стратегий, если раздел виден
  const loadStrategyAnalysisBtn = document.getElementById('loadStrategyAnalysis');
  const strategyAnalysisDiv = document.getElementById('strategyAnalysis');
  
  if (loadStrategyAnalysisBtn && strategyAnalysisDiv && !strategyAnalysisDiv.classList.contains('hidden')) {
    // Если раздел анализа стратегий виден - перегенерируем его
    loadStrategyAnalysisBtn.click();
      }
      
      console.log('✅ Перегенерация завершена успешно');
      return; // ✅ Завершаем, так как перегенерация прошла успешно
      
    } catch (error) {
      console.error('❌ Ошибка перегенерации отчета:', error);
      const analyzeBtn = document.getElementById('analyzeBtn');
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = t('analyze') || '🚀 Запустить анализ';
      }
      if (typeof showToast === 'function') {
        showToast('❌ Ошибка перегенерации отчета: ' + error.message, 'error');
      }
    }
  } else {
    console.log('⚠️ lastAnalysisParams не найден, перегенерация невозможна');
  }
}

// --- Обновление таймфрейма ---
function updateTimeframeInfo() {
  const tfMap = { 
    "scalping": "5m", 
    "daytrading": "1h", 
    "swing": "4h", 
    "medium_term": "1d", 
    "long_term": "1w" 
  };
  const tradingTypeSelect = document.getElementById("trading_type");
  if (!tradingTypeSelect) return;
  
  const val = tradingTypeSelect.value;
  const recommendedTf = tfMap[val] || "1h";
  const tfInfo = document.getElementById("tfInfo");
  if (tfInfo) {
    tfInfo.textContent = t("recommended") + ": " + recommendedTf;
  }
}

// === Real-Time график и WebSocket ===
// ✅ ИСПРАВЛЕНО: Объявляем переменные ДО блока DOMContentLoaded
let realtimeChart = null;
let wsConnection = null;
let currentAnalysis = null; // Хранит entry_price, stop_loss, take_profit, direction
let priceHistory = []; // История цен для графика (close)
let timeHistory = []; // История времени
let ohlcData = []; // ✅ НОВОЕ: OHLC данные для свечей [open, high, low, close]
let lastPrice = null; // Последняя цена для расчета изменения
let wsReconnectTimer = null; // Таймер для переподключения
let wsManuallyStopped = false; // Флаг ручной остановки
let currentSymbol = null; // Текущий символ для WebSocket
let currentTimeframe = null; // Текущий таймфрейм для WebSocket
let linesHideTimer = null; // Таймер для автоматического скрытия линий анализа
let trailingStopState = {
  enabled: false,
  entryPrice: null,
  stopLoss: null,
  takeProfit: null,
  trailingStop: null,
  direction: null,
  lastUpdated: null
};

function safeCloseWebSocket(socket, code = 1000, reason = '') {
  try {
    if (!socket) return;
    if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
    socket.close(code, reason);
  } catch (e) {
    // ignore
  }
}

function bucketDateByTimeframe(date, timeframe = '1h') {
  const tf = String(timeframe || '1h').trim();
  const d = new Date(date);

  if (tf === '1M') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const m = tf.match(/^(\d+)([mhdw])$/i);
  if (!m) return d;

  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const unitMs =
    unit === 'm' ? 60 * 1000 :
    unit === 'h' ? 60 * 60 * 1000 :
    unit === 'd' ? 24 * 60 * 60 * 1000 :
    unit === 'w' ? 7 * 24 * 60 * 60 * 1000 :
    0;
  const intervalMs = n * unitMs;
  if (!intervalMs) return d;
  return new Date(Math.floor(d.getTime() / intervalMs) * intervalMs);
}

function formatTime(date, timeframe = '1h') {
  const d = bucketDateByTimeframe(date, timeframe);
  const tf = String(timeframe || '1h');
  const pad = (v) => String(v).padStart(2, '0');

  if (tf === '1d' || tf === '3d' || tf === '1w') {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  if (tf === '1M') {
    return `${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  const day = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${day} ${time}`;
}

function normalizeSymbol(symbol) {
  const s = String(symbol || '').trim().toUpperCase();
  if (!s) return '';
  // Already like BTC/USDT
  if (s.includes('/')) {
    const parts = s.split('/').map(p => p.trim()).filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : s;
  }
  // Variants: BTCUSDT, BTC-USDT, BTC_USDT
  const compact = s.replace(/[-_]/g, '');
  const knownQuotes = ['USDT', 'BUSD', 'USDC', 'FDUSD', 'BTC', 'ETH'];
  for (const q of knownQuotes) {
    if (compact.endsWith(q) && compact.length > q.length) {
      const base = compact.slice(0, -q.length);
      return `${base}/${q}`;
    }
  }
  return s;
}

function updateRealtimeChartScale() {
  if (!realtimeChart || !Array.isArray(priceHistory) || priceHistory.length === 0) return;
  const nums = priceHistory.map(v => Number(v)).filter(v => Number.isFinite(v));
  // Include analysis levels so they are not clipped by fixed min/max
  if (currentAnalysis) {
    const extra = [
      Number(currentAnalysis.entry_price),
      Number(currentAnalysis.stop_loss),
      Number(currentAnalysis.take_profit)
    ].filter(v => Number.isFinite(v) && v > 0);
    nums.push(...extra);
  }
  if (!nums.length) return;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = (max - min) * 0.03;
  try {
    if (realtimeChart.options && realtimeChart.options.scales && realtimeChart.options.scales.y) {
      realtimeChart.options.scales.y.min = Math.max(0, min - pad);
      realtimeChart.options.scales.y.max = max + pad;
    }
  } catch (e) {
    // ignore
  }
}

function updatePriceInfo(price, symbol = null) {
  const priceEl = document.getElementById('currentPrice');
  if (!priceEl) return;

  if (symbol) {
    const symbolEl = document.getElementById('currentSymbol');
    if (symbolEl) symbolEl.textContent = symbol;
  }

  const p = Number(price);
  if (!Number.isFinite(p)) return;

  if (lastPrice === null) {
    lastPrice = p;
    priceEl.textContent = `$${p.toFixed(2)}`;
    return;
  }

  const change = p - lastPrice;
  const changePercent = lastPrice !== 0 ? (change / lastPrice) * 100 : 0;
  priceEl.textContent = `$${p.toFixed(2)}`;

  const changeEl = document.getElementById('priceChange');
  if (changeEl) {
    const sign = change >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
    changeEl.style.color = change >= 0 ? '#34D399' : '#EF4444';
  }

  lastPrice = p;
}

function initRealtimeChart() {
  const ctx = document.getElementById('realtimeChart');
  if (!ctx) return;
  if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js не загружен');
    return;
  }

  const humanizeLabel = (s) => {
    const raw = String(s || '').trim();
    if (!raw) return '';
    const withSpaces = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const safeT = (key, fallback) => {
    try {
      const v = typeof t === 'function' ? t(key) : '';
      if (v && v !== key && !String(v).includes('_')) return String(v);
    } catch (e) {
      // ignore
    }
    return fallback;
  };

  const chartLabels = {
    price: safeT('chart_price', 'Price'),
    entry: safeT('chart_entry', 'Entry'),
    stopLoss: safeT('chart_stop_loss', 'Stop Loss'),
    takeProfit: safeT('chart_take_profit', 'Take Profit'),
    trailingStop: safeT('chart_trailing_stop', 'Trailing Stop Loss')
  };

  const ohlcLabels = (() => {
    if (currentLanguage === 'en') return { open: 'Open', high: 'High', low: 'Low', close: 'Close' };
    if (currentLanguage === 'uk') return { open: 'Відкриття', high: 'Макс', low: 'Мін', close: 'Закриття' };
    return { open: 'Открытие', high: 'Макс', low: 'Мин', close: 'Закрытие' };
  })();

  const resolvePriceDatasetLabel = () => {
    const key = 'chart_price_dataset_label';
    try {
      const v = typeof t === 'function' ? t(key) : '';
      if (v && v !== key && !String(v).includes('_')) return String(v);
    } catch (e) {
      // ignore
    }
    return chartLabels.price;
  };

  if (realtimeChart) {
    try {
      realtimeChart.destroy();
    } catch (e) {
      // ignore
    }
    realtimeChart = null;
  }

  realtimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeHistory,
      datasets: [
        {
          label: resolvePriceDatasetLabel(),
          data: priceHistory,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          fill: false,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      devicePixelRatio: 2,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          ticks: { color: '#e6e6e6' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: {
          ticks: { color: '#e6e6e6' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#e6e6e6',
            boxWidth: 18,
            boxHeight: 10,
            font: { size: 12, family: 'Segoe UI, Roboto, sans-serif', weight: '400' },
            generateLabels(chart) {
              const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              return labels.map((l) => {
                const text = String(l.text || '').trim();
                if (!text) return l;

                // Replace raw translation keys like chart_price_dataset_label
                if (/\bchart_/i.test(text) && text.includes('_')) {
                  l.text = humanizeLabel(text);
                  return l;
                }

                // Standardize common dataset labels
                const lower = text.toLowerCase();
                if (lower === 'entry') l.text = chartLabels.entry;
                if (lower === 'stop loss') l.text = chartLabels.stopLoss;
                if (lower === 'take profit') l.text = chartLabels.takeProfit;
                if (lower === 'trailing stop loss') l.text = chartLabels.trailingStop;
                if (lower === 'price') l.text = chartLabels.price;

                return l;
              });
            }
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label(context) {
              const dsLabel = String(context.dataset?.label || '').trim();
              const idx = context.dataIndex;
              const v = Number(context.parsed?.y);
              const fmtPrice = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : String(context.formattedValue || ''));

              // Price dataset: show OHLC when available
              if (context.datasetIndex === 0) {
                const o = ohlcData && ohlcData[idx] ? ohlcData[idx] : null;
                if (o && [o.open, o.high, o.low, o.close].every(x => Number.isFinite(Number(x)))) {
                  return `${chartLabels.price}: ${fmtPrice(v)}  |  ${ohlcLabels.open} ${fmtPrice(Number(o.open))}  ${ohlcLabels.high} ${fmtPrice(Number(o.high))}  ${ohlcLabels.low} ${fmtPrice(Number(o.low))}  ${ohlcLabels.close} ${fmtPrice(Number(o.close))}`;
                }
                return `${chartLabels.price}: ${fmtPrice(v)}`;
              }

              // Level lines
              const lower = dsLabel.toLowerCase();
              const name =
                lower === 'entry' ? chartLabels.entry :
                lower === 'stop loss' ? chartLabels.stopLoss :
                lower === 'take profit' ? chartLabels.takeProfit :
                lower === 'trailing stop loss' ? chartLabels.trailingStop :
                dsLabel;
              return `${name}: ${fmtPrice(v)}`;
            }
          }
        }
      }
    }
  });
}

function getActiveSymbolForChart() {
  const isBeginner = Boolean(window.isBeginnerMode);
  if (isBeginner) {
    const beginnerSelect = document.getElementById('beginnerSymbol');
    const v = beginnerSelect?.value;
    if (v) return v;
  }
  const mainSelect = document.getElementById('symbol');
  return mainSelect?.value || 'BTC/USDT';
}

function syncSymbolSelects(newSymbol) {
  const mainSelect = document.getElementById('symbol');
  const beginnerSelect = document.getElementById('beginnerSymbol');
  if (mainSelect && mainSelect.value !== newSymbol) mainSelect.value = newSymbol;
  if (beginnerSelect && beginnerSelect.value !== newSymbol) beginnerSelect.value = newSymbol;
}

let wsLastMessageAt = 0;
let wsWatchdogTimer = null;

function startWsSilenceWatchdog() {
  if (wsWatchdogTimer) {
    clearInterval(wsWatchdogTimer);
    wsWatchdogTimer = null;
  }

  wsWatchdogTimer = setInterval(() => {
    if (wsManuallyStopped) return;
    if (!currentSymbol || !currentTimeframe) return;

    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      const last = wsLastMessageAt;
      if (last > 0 && (Date.now() - last) > 8000) {
        if (window.startPriceUpdateFallback) {
          window.startPriceUpdateFallback(currentSymbol, currentTimeframe);
        }
      }
    }
  }, 2500);
}

function stopWsSilenceWatchdog() {
  if (wsWatchdogTimer) {
    clearInterval(wsWatchdogTimer);
    wsWatchdogTimer = null;
  }
  wsLastMessageAt = 0;
}

// ✅ ИСПРАВЛЕНО: Остановка WebSocket (перемещена в глобальную область)
function stopWebSocket() {
  // Очищаем таймер скрытия линий
  if (linesHideTimer) {
    clearTimeout(linesHideTimer);
    linesHideTimer = null;
  }

  stopWsSilenceWatchdog();
  
  wsManuallyStopped = true; // Устанавливаем флаг ручной остановки
  currentSymbol = null; // Очищаем символ
  
  // Очищаем таймер переподключения
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  if (window.stopPriceUpdateFallback) {
    window.stopPriceUpdateFallback();
  }
  
  if (wsConnection) {
    safeCloseWebSocket(wsConnection, 1000, 'Manual stop');
    wsConnection = null;
  }
  
  priceHistory = [];
  timeHistory = [];
  currentAnalysis = null;
  lastPrice = null;
  currentTimeframe = null; // Очищаем таймфрейм
  
  // НЕ скрываем контейнер - график должен быть всегда виден
  // Пользователь может остановить только WebSocket, но график остается
  
  if (typeof showToast === 'function') {
    showToast('⏹ Real-Time котировки остановлены', 'info');
  }
}

// ✅ ИСПРАВЛЕНО: Подключение к WebSocket (как на Binance: история через REST, обновления через WS)
function connectWebSocket(symbol, timeframe = '1h') {
  console.log(`🔄 connectWebSocket вызван для ${symbol}, текущий currentSymbol: ${currentSymbol}`);
  
  wsManuallyStopped = false;

  const symbolEl = document.getElementById('currentSymbol');
  if (symbolEl) {
    symbolEl.textContent = symbol;
  }

  // ✅ НОВОЕ: Сохраняем символ СРАЗУ в начале функции
  const previousSymbol = currentSymbol;
  currentSymbol = symbol;
  currentTimeframe = timeframe;
  
  // ✅ НОВОЕ: Если символ не изменился и есть активное подключение, не переподключаемся
  if (previousSymbol === symbol && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    console.log(`✅ Уже подключены к ${symbol}, пропускаем переподключение`);
    return;
  }
  
  // ✅ НОВОЕ: Сохраняем ссылку на старое соединение и создаем уникальный ID для нового
  const oldConnection = wsConnection;
  const connectionId = Date.now() + Math.random(); // Уникальный ID для этого соединения
  const connectionSymbol = symbol; // Сохраняем символ для проверки
  
  // Преобразуем BTC/USDT в btcusdt
  const wsSymbol = symbol.replace('/', '').toLowerCase();
  
  // Очищаем старые данные
  priceHistory = [];
  timeHistory = [];
  
  // ✅ УЛУЧШЕНО: Правильно закрываем старое подключение
  if (oldConnection) {
    // ✅ НОВОЕ: Сохраняем состояние перед закрытием для логирования
    const oldState = oldConnection.readyState;
    const stateNames = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    };
    const oldStateName = stateNames[oldState] || `UNKNOWN(${oldState})`;

    console.log(`🔄 Закрытие старого WebSocket соединения (состояние: ${oldStateName}) для переключения на ${symbol}`);
    safeCloseWebSocket(oldConnection, 1000, 'Switching symbol');
  }
  
  // ✅ НОВОЕ: Очищаем переменную wsConnection перед созданием нового
  wsConnection = null;
  
  // Очищаем таймер переподключения
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  
  // ✅ ИСПРАВЛЕНО: Останавливаем старый fallback перед запуском нового
  if (window.stopPriceUpdateFallback) {
    window.stopPriceUpdateFallback();
  }
  
  // Убеждаемся, что график инициализирован
  if (!realtimeChart) {
    const ctx = document.getElementById('realtimeChart');
    if (ctx) {
      initRealtimeChart();
    }
  }
  
  // ✅ УЛУЧШЕНО: Определяем количество свечей для загрузки в зависимости от таймфрейма
  // Для коротких таймфреймов загружаем только последние несколько часов данных (как на Binance)
  let limit = 500;
  if (timeframe === '1M') limit = 100;
  else if (timeframe === '1w') limit = 200;
  else if (timeframe === '1d' || timeframe === '3d') limit = 300;
  else if (timeframe === '12h' || timeframe === '8h' || timeframe === '6h' || timeframe === '4h') limit = 400;
  else if (timeframe === '2h' || timeframe === '1h') limit = 500;
  else if (timeframe === '30m') limit = 120; // 60 часов данных
  else if (timeframe === '15m') limit = 200; // 50 часов данных
  else if (timeframe === '5m') limit = 240; // 20 часов данных
  else if (timeframe === '3m') limit = 300; // 15 часов данных
  else if (timeframe === '1m') limit = 200; // ✅ ИСПРАВЛЕНО: 200 минут = ~3.3 часа (как на Binance)
  
  // ШАГ 1: Загружаем исторические данные через наш backend
  fetch(`/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&limit=${limit}`)
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          throw new Error(err.error || 'Network response was not ok');
        });
      }
      return res.json();
    })
    .then(klines => {
      // Очищаем график
      priceHistory = [];
      timeHistory = [];
      ohlcData = []; // ✅ НОВОЕ: Очищаем OHLC данные
      
      // ✅ УЛУЧШЕНО: Добавляем исторические данные с OHLC
      // Формат kline: [timestamp, open, high, low, close, volume, ...]
      klines.forEach(kline => {
        const timestamp = new Date(kline[0]);
        const open = parseFloat(kline[1]);
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        const close = parseFloat(kline[4]);
        const timeStr = formatTime(timestamp, timeframe);
        
        priceHistory.push(close);
        timeHistory.push(timeStr);
        ohlcData.push({ open, high, low, close }); // ✅ НОВОЕ: Сохраняем OHLC данные
      });
      
      // Обновляем график с историей
      if (realtimeChart) {
        realtimeChart.data.labels = [...timeHistory];
        realtimeChart.data.datasets[0].data = [...priceHistory];
        updateRealtimeChartScale();
        realtimeChart.update('none');
      }
      
      // Обновляем текущую цену
      if (priceHistory.length > 0) {
        const lastPriceValue = priceHistory[priceHistory.length - 1];
        updatePriceInfo(lastPriceValue, currentSymbol);
        lastPrice = lastPriceValue;
      }
      
      console.log(`✅ Загружено ${klines.length} исторических свечей для ${symbol} (${timeframe})`);
      if (typeof showToast === 'function') {
        showToast('📡 Real-Time котировки подключены', 'success');
      }
      
      // ШАГ 2: Подключаемся к WebSocket для обновлений в реальном времени
      // ✅ УЛУЧШЕНО: Увеличена задержка для гарантии закрытия старого соединения
      setTimeout(() => {
        // ✅ НОВОЕ: Проверяем, что символ не изменился за это время
        if (currentSymbol !== connectionSymbol) {
          console.log(`⚠️ Символ изменился с ${connectionSymbol} на ${currentSymbol}, отменяем подключение`);
          return;
        }
        
        if (wsManuallyStopped) {
          return;
        }
        
        const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`;
        wsManuallyStopped = false;
        
        try {
          // ✅ НОВОЕ: Финальная проверка перед созданием соединения
          if (currentSymbol !== connectionSymbol) {
            console.log(`⚠️ Символ изменился с ${connectionSymbol} на ${currentSymbol}, отменяем создание WebSocket`);
        return;
      }
      
          // ✅ НОВОЕ: Проверяем, что нет активного соединения
          if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            console.log(`⚠️ Уже есть активное соединение, пропускаем создание нового`);
            return;
          }
          
          console.log(`🔌 Создание нового WebSocket соединения для ${connectionSymbol} (${timeframe})`);
          wsConnection = new WebSocket(wsUrl);
          // ✅ НОВОЕ: Сохраняем ID и символ соединения для проверки
          wsConnection._connectionId = connectionId;
          wsConnection._symbol = connectionSymbol;
          
          wsConnection.onopen = () => {
            // ✅ НОВОЕ: Проверяем, что это все еще текущее соединение
            if (!wsConnection || wsConnection._connectionId !== connectionId || wsConnection._symbol !== currentSymbol) {
              console.warn('⚠️ Старое WebSocket соединение открылось, закрываем его');
              if (wsConnection) {
                try {
                  wsConnection.close(1000, 'Replaced by new connection');
                } catch (e) {
                  // Игнорируем ошибки закрытия
                }
              }
              return;
            }
            
            console.log(`✅ WebSocket подключен для обновлений ${currentSymbol} (таймфрейм: ${currentTimeframe})`);
            wsLastMessageAt = Date.now();
            startWsSilenceWatchdog();
            // ✅ ВОССТАНОВЛЕНО: Показываем уведомление при подключении
            if (typeof showToast === 'function') {
              showToast(`📊 Онлайн график подключен: ${currentSymbol} (${currentTimeframe})`, 'success', 3000);
            }
            if (window.stopPriceUpdateFallback) {
              window.stopPriceUpdateFallback();
            }
          };
          
          wsConnection.onmessage = (event) => {
            // ✅ НОВОЕ: Проверяем, что это сообщение от текущего активного соединения
            if (!wsConnection || wsConnection._connectionId !== connectionId || wsConnection._symbol !== currentSymbol) {
              // Игнорируем сообщения от старых соединений (не логируем, чтобы не засорять консоль)
              return;
            }
            
            try {
              const data = JSON.parse(event.data);

              wsLastMessageAt = Date.now();

              if (window.stopPriceUpdateFallback) {
                window.stopPriceUpdateFallback();
              }
              
              // ✅ НОВОЕ: Проверяем, что данные относятся к текущему символу
              if (data.stream) {
                // Извлекаем символ из stream (например: "ethusdt@kline_1h")
                const streamSymbol = data.stream.split('@')[0].toUpperCase();
                const expectedSymbol = currentSymbol?.replace('/', '').toUpperCase();
                if (streamSymbol !== expectedSymbol) {
                  // Не логируем, так как это может быть старое соединение
                  return;
                }
              }
              
              if (data.k) {
                const kline = data.k;
                // ✅ НОВОЕ: Дополнительная проверка символа из kline
                const klineSymbol = kline.s?.toUpperCase();
                const expectedSymbol = currentSymbol?.replace('/', '').toUpperCase();
                if (klineSymbol && klineSymbol !== expectedSymbol) {
                  // Не логируем, так как это может быть старое соединение
                  return;
                }
                
                const price = parseFloat(kline.c);
                const open = parseFloat(kline.o);
                const high = parseFloat(kline.h);
                const low = parseFloat(kline.l);
                const timestamp = new Date(kline.t);
                const timeStr = formatTime(timestamp, timeframe);
                
                const lastTimeIndex = timeHistory.length - 1;
                const lastTimeStr = lastTimeIndex >= 0 ? timeHistory[lastTimeIndex] : null;
                
                if (lastTimeStr === timeStr && lastTimeIndex >= 0) {
                  // ✅ ИСПРАВЛЕНО: Обновляем текущую свечу
                  priceHistory[lastTimeIndex] = price;
                  timeHistory[lastTimeIndex] = timeStr;
                  
                  // ✅ ИСПРАВЛЕНО: Обновляем ohlcData для текущей свечи
                  if (ohlcData[lastTimeIndex]) {
                    ohlcData[lastTimeIndex] = {
                      open: ohlcData[lastTimeIndex].open, // Open не меняется
                      high: Math.max(ohlcData[lastTimeIndex].high || high, high),
                      low: Math.min(ohlcData[lastTimeIndex].low || low, low),
                      close: price
                    };
                  } else if (ohlcData.length === lastTimeIndex) {
                    ohlcData.push({ open, high, low, close: price });
                  }
        } else {
                  // ✅ НОВАЯ свеча
                  priceHistory.push(price);
                  timeHistory.push(timeStr);
                  ohlcData.push({ open, high, low, close: price });
                  
                  if (priceHistory.length > limit) {
                    priceHistory.shift();
                    timeHistory.shift();
                    ohlcData.shift();
                  }
                }
                
                if (realtimeChart) {
                  // ✅ ИСПРАВЛЕНО: Создаем новые массивы для правильного обновления Chart.js
                  const newLabels = Array.from(timeHistory);
                  const newPriceData = Array.from(priceHistory);
                  
                  // Обновляем labels и данные
                  realtimeChart.data.labels = newLabels;
                  realtimeChart.data.datasets[0].data = newPriceData;
                  
                  // ✅ ИСПРАВЛЕНО: Обновляем линии анализа (Entry, Stop Loss и т.д.)
                  // Начинаем с индекса 1, так как 0 - цена
                  if (currentAnalysis && realtimeChart.data.datasets.length > 1) {
                    for (let i = 1; i < realtimeChart.data.datasets.length; i++) {
                      const dataset = realtimeChart.data.datasets[i];
                      if (dataset.label === 'Entry' || dataset.label === 'Stop Loss' || dataset.label === 'Take Profit' || dataset.label === 'Trailing Stop Loss' ||
                          dataset.label === t('chart_entry') || dataset.label === t('chart_stop_loss') || dataset.label === t('chart_take_profit') || dataset.label === t('chart_trailing_stop')) {
                        const lineValue = dataset.data && dataset.data.length > 0 
                          ? (dataset.data[0] || dataset.data[dataset.data.length - 1])
                          : null;
                        if (lineValue !== null) {
                          dataset.data = newPriceData.map(() => lineValue);
                        }
                      }
                    }
                  }
                  
                  // ✅ ИСПРАВЛЕНО: Обновляем график без анимации
                  updateRealtimeChartScale();
                  realtimeChart.update('none');
                }
                
                updatePriceInfo(price, currentSymbol);
                
                if (typeof trailingStopState !== 'undefined' && trailingStopState && trailingStopState.enabled) {
                  if (typeof updateTrailingStop === 'function') {
                    updateTrailingStop(price);
                  }
                }
                
                lastPrice = price;
                
                // ✅ НОВОЕ: Проверяем TP/SL если есть анализ (с проверкой функции)
                if (currentAnalysis && typeof checkSignalLevels === 'function') {
                  checkSignalLevels(price);
                }
              }
            } catch (error) {
              console.error('❌ Ошибка обработки сообщения WebSocket:', error, event.data);
            }
          };
          
          wsConnection.onerror = (error) => {
            // ✅ НОВОЕ: Проверяем, что это текущее соединение
            if (!wsConnection || wsConnection._connectionId !== connectionId) {
        return;
      }
      
            if (!wsManuallyStopped) {
              // ✅ УЛУЧШЕНО: Правильное строковое логирование ошибок
              const stateNames = {
                0: 'CONNECTING',
                1: 'OPEN',
                2: 'CLOSING',
                3: 'CLOSED'
              };
              const stateName = wsConnection.readyState !== undefined 
                ? stateNames[wsConnection.readyState] || `UNKNOWN(${wsConnection.readyState})`
                : 'UNKNOWN';
              
              // Извлекаем информацию из объекта ошибки в читаемый формат
              const errorType = error?.type || 'unknown';
              const errorUrl = wsConnection?.url || 'unknown';
              const errorMessage = error?.message || 'WebSocket error occurred';
              
              // ✅ ИСПРАВЛЕНО: Логируем строки вместо объектов
              console.warn(`⚠️ WebSocket ошибка для ${connectionSymbol}:`, 
                `Состояние: ${stateName}, Тип: ${errorType}, URL: ${errorUrl}`);
              
              if (errorMessage && errorMessage !== 'WebSocket error occurred') {
                console.warn(`   Детали: ${errorMessage}`);
              }
              
              // Запускаем fallback при ошибке только если соединение не было закрыто вручную
              if (window.startPriceUpdateFallback && !wsManuallyStopped && wsConnection.readyState !== WebSocket.CLOSED) {
                // ✅ ИСПРАВЛЕНО: Используем currentSymbol вместо symbol
                window.startPriceUpdateFallback(currentSymbol, currentTimeframe);
              }
            }
          };
          
          wsConnection.onclose = (event) => {
            // ✅ НОВОЕ: Проверяем, что это текущее соединение
            if (!wsConnection || wsConnection._connectionId !== connectionId) {
              return;
            }
            
            if (wsManuallyStopped) {
              return;
            }
            
            console.log('WebSocket закрыт', event.code, event.reason);
            
            // Запускаем fallback при закрытии
            if (event.code !== 1000 && currentSymbol && !wsManuallyStopped) {
              if (window.startPriceUpdateFallback) {
                // ✅ ИСПРАВЛЕНО: Используем currentSymbol вместо symbol
                window.startPriceUpdateFallback(currentSymbol, currentTimeframe);
              }
            }
            
            if (event.code !== 1000 && currentSymbol && !wsManuallyStopped) {
              if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
              }
              
              wsReconnectTimer = setTimeout(() => {
                if (!wsManuallyStopped && currentSymbol && currentTimeframe) {
                  console.log('🔄 Переподключение к WebSocket...');
                  connectWebSocket(currentSymbol, currentTimeframe);
                }
              }, 3000);
            }
          };
        } catch (e) {
          console.error('Ошибка создания WebSocket:', e);
          // Запускаем fallback при ошибке создания
          if (window.startPriceUpdateFallback) {
            // ✅ ИСПРАВЛЕНО: Используем currentSymbol вместо symbol
            window.startPriceUpdateFallback(currentSymbol, currentTimeframe);
          }
          if (typeof showToast === 'function') {
            showToast('⚠️ Ошибка подключения к WebSocket', 'error');
          }
        }
      }, 800); // ✅ УЛУЧШЕНО: Увеличена задержка до 800 мс для гарантии закрытия старого соединения
    })
    .catch(err => {
      console.error('Ошибка загрузки исторических данных:', err);
      const errorMsg = err.message || 'Ошибка загрузки данных';
      
      // Запускаем fallback при ошибке загрузки истории
      if (window.startPriceUpdateFallback) {
        // ✅ ИСПРАВЛЕНО: Используем currentSymbol вместо symbol
        window.startPriceUpdateFallback(currentSymbol, currentTimeframe);
      }
      
      if (typeof showToast === 'function') {
        if (errorMsg.includes('не найдена на бирже')) {
          showToast(`⚠️ ${errorMsg}\nВозможно, данная пара не торгуется на Binance.`, 'error', 8000);
        } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
          showToast('⚠️ Ошибка подключения к серверу. Проверьте интернет-соединение.', 'error', 5000);
        } else {
          showToast(`⚠️ Ошибка загрузки данных: ${errorMsg}`, 'error', 5000);
        }
      }
    });
  }

// ✅ ГЛОБАЛЬНЫЕ ФУНКЦИИ: Вынесены для доступа из regenerateReportsOnLanguageChange
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatInlineStrong(text) {
  const safe = escapeHtml(String(text || ""));
  return safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function formatAutoSummaryHtml(summaryText) {
  const raw = String(summaryText || "").replace(/\r/g, "").trim();
  if (!raw) return "";

  const localizedRaw = raw
    .replace(/\bClose\b/g, t('value_close'))
    .replace(/\bclose\b/g, t('value_close'))
    .replace(/\(\s*Neutral\s*\)/gi, `(${t('value_neutral')})`)
    .replace(/\bNeutral\b/gi, t('value_neutral'));

  const knownIcons = ["📊", "📈", "🏆", "💎", "⏰", "🤖", "🔥", "✅", "⚠️"]; 
  const lines = localizedRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const items = [];

  function parseLine(line) {
    let icon = "";
    let rest = line;

    for (const k of knownIcons) {
      if (rest.startsWith(k)) {
        icon = k;
        rest = rest.slice(k.length).trim();
        break;
      }
    }

    const m = rest.match(/^\*\*(.+?)\*\*:\s*(.*)$/);
    const title = m ? m[1] : "";
    const body = m ? m[2] : rest;
    return { icon, title, body };
  }

  for (const line of lines) {
    const parsed = parseLine(line);
    const isNewItem = Boolean(parsed.icon) || Boolean(parsed.title);

    if (isNewItem || items.length === 0) {
      items.push({ icon: parsed.icon, title: parsed.title, body: parsed.body });
    } else {
      const prev = items[items.length - 1];
      const extra = parsed.body;
      if (extra) {
        prev.body = prev.body ? `${prev.body}\n${extra}` : extra;
      } else {
        prev.body = prev.body ? `${prev.body}\n` : '';
      }
    }
  }

  const html = items.map(it => {
    const iconHtml = it.icon
      ? `<div class="auto-summary-icon">${escapeHtml(it.icon)}</div>`
      : `<div class="auto-summary-icon auto-summary-icon-empty"></div>`;

    const titleHtml = it.title ? `<div class="auto-summary-title">${formatInlineStrong(it.title)}</div>` : '';
    const bodyHtml = it.body ? `<div class="auto-summary-body">${formatInlineStrong(it.body).replace(/\n/g, '<br>')}</div>` : '';
    return `<div class="auto-summary-item">${iconHtml}<div class="auto-summary-main">${titleHtml}${bodyHtml}</div></div>`;
  }).join('');

  return `<div class="auto-summary-list">${html}</div>`;
}

function mdTableToHtml(lines) {
  function normalizePlainToken(text) {
    return String(text || '').trim().replace(/^\((.*)\)$/, '$1');
  }

  function localizeReportToken(text) {
    const raw = normalizePlainToken(text);
    if (!raw) return raw;

    const upper = raw.toUpperCase();
    if (upper === 'ALL') return t('value_all');
    if (upper === 'NONE') return t('value_none');

    const lower = raw.toLowerCase();
    if (lower === 'close') return t('value_close');
    if (lower === 'trend') return t('value_trend');
    if (lower === 'uptrend') return t('value_uptrend');
    if (lower === 'downtrend') return t('value_downtrend');
    if (lower === 'neutral') return t('value_neutral');

    return raw;
  }

  function formatCellHtml(cellText) {
    const raw = String(cellText || "");
    const trimmed = raw.trim();
    const plain = trimmed.replace(/\*\*/g, '').trim();
    const localizedPlain = localizeReportToken(plain);
    const normalizedLocalized = localizedPlain === plain ? trimmed : ( /^\*\*.*\*\*$/.test(trimmed) ? `**${localizedPlain}**` : localizedPlain );
    const safe = escapeHtml(String(normalizedLocalized || ""));
    return safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function isUserConfirmationsLabel(text) {
    const s = String(text || '').replace(/\*/g, '').trim().toLowerCase();
    return /confirm|подтверж|підтвердж/.test(s);
  }

  function chipsFromConfirmationValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const lower = raw.toLowerCase();
    const isNone = /no confirmations|нет.*подтверж|немає.*підтвердж/.test(lower);
    const isAll = /all confirmations|все подтверж|всі підтвердж/.test(lower);
    const chipClass = isAll ? 'confirm-ok' : isNone ? 'confirm-bad' : 'neutral';

    let parts = (raw.includes('+') ? raw.split('+') : raw.split(','))
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length <= 1 && /\s/.test(raw) && !/[+\,]/.test(raw)) {
      parts = raw.split(/\s+/).map(p => p.trim()).filter(Boolean);
    }

    return `<div class="confirmation-chips">${parts
      .map(p => {
        const localized = localizeReportToken(p);
        const wrapped = p.trim().startsWith('(') && p.trim().endsWith(')') ? `(${localized})` : localized;
        return `<span class="chip ${chipClass}">${escapeHtml(wrapped)}</span>`;
      })
      .join('')}</div>`;
  }

  const rows = lines.map(l => l.trim()).filter(l => l && !/^[-| ]+$/.test(l));
  if (!rows.length) return "";
  const cells = rows.map(r => r.split("|").map(c => c.trim()).filter(Boolean));
  const thead = cells[0];
  const body = cells.slice(1);
  let html = '<table class="report-table"><thead><tr>';
  thead.forEach(h => html += `<th>${formatCellHtml(h)}</th>`);
  html += "</tr></thead><tbody>";
  body.forEach(r => {
    html += "<tr>";
    const rowLabelRaw = String(r[0] || '');
    const isConfirmationsRow = isUserConfirmationsLabel(rowLabelRaw);
    thead.forEach((_, i) => {
      if (isConfirmationsRow && i > 0) {
        html += `<td>${chipsFromConfirmationValue(r[i] || "")}</td>`;
      } else {
        html += `<td>${formatCellHtml(r[i] || "")}</td>`;
      }
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

function renderReport(md) {
  if (!md) return "";
  // ✅ Markdown уже переведен на сервере через translate_markdown()
  // Не нужно заменять ключи на клиенте
  const lines = md.replace(/\r/g, "").split("\n");
  const header = { title: "", generated: "", bias: "", side: "", reliability: "", meta: "" };
  let i = 0;

  function formatGeneratedDate(raw) {
    const s = String(raw || '').trim();
    // Expected: 2026-01-15 13:04:19 (EET)
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return s;
    const [, yyyy, mm, dd, hh, mi, ss] = m;
    return `${dd}.${mm}.${yyyy}, ${hh}:${mi}:${ss}`;
  }

  function parsePercentFromText(text) {
    const m = String(text || '').match(/([0-9]+(?:[\.,][0-9]+)?)\s*%/);
    if (!m) return null;
    return m[1];
  }

  function getUiTimeframe() {
    const tf = (window.lastAnalysisParams && window.lastAnalysisParams.timeframe) ? window.lastAnalysisParams.timeframe : null;
    if (tf && tf !== 'auto') return tf;
    const tfSelect = document.getElementById('timeframe');
    const v1 = tfSelect?.value;
    if (v1 && v1 !== 'auto') return v1;
    const chartTf = document.getElementById('chartTimeframe')?.value;
    return chartTf || '';
  }

  function localizeReportToken(text) {
    const raw = String(text || '').trim().replace(/^\((.*)\)$/, '$1');
    if (!raw) return raw;
    const upper = raw.toUpperCase();
    if (upper === 'ALL') return t('value_all');
    if (upper === 'NONE') return t('value_none');
    const lower = raw.toLowerCase();
    if (lower === 'close') return t('value_close');
    if (lower === 'trend') return t('value_trend');
    if (lower === 'uptrend') return t('value_uptrend');
    if (lower === 'downtrend') return t('value_downtrend');
    if (lower === 'neutral') return t('value_neutral');
    return raw;
  }

  function localizeBiasText(text) {
    const raw = String(text || '');
    if (!raw) return raw;
    const replaced = raw
      .replace(/\bNeutral\b/gi, localizeReportToken('neutral'))
      .replace(/\bClose\b/gi, localizeReportToken('close'))
      .replace(/\bclose\b/gi, localizeReportToken('close'))
      .replace(/\(\s*Neutral\s*\)/gi, `(${localizeReportToken('neutral')})`);
    return replaced;
  }

  function normalizeMetaText(meta) {
    const raw = String(meta || '').trim();
    if (!raw) return '';
    // Replace timeframe codes with localized labels to avoid "1h час" cases.
    const tfCode = getUiTimeframe();
    const tfLabel = tfCode ? (t(tfCode) || tfCode) : '';
    let out = raw;

    if (tfCode) {
      const tfWord = '(?:час(?:а|ов)?|годин(?:а|и)?|hours?)';
      const re = new RegExp(`\\b${tfCode}\\b\\s*(?:${tfWord})?`, 'gi');
      out = out.replace(re, tfLabel);
    }
    out = out.replace(/\s{2,}/g, ' ');
    return out;
  }

  function extractHeaderExtras(sections) {
    let trendValue = '';
    let reliability = '';
    let tradingType = '';
    let strategy = '';

    for (const sec of (sections || [])) {
      for (const rawLine of (sec.content || [])) {
        const line = String(rawLine || '').trim();

        // Summary table rows
        if (line.includes('|')) {
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          if (cells.length >= 2) {
            const label = cells[0];
            const value = cells[1];

            if (!trendValue && /\bUptrend\b|\bDowntrend\b/i.test(value)) {
              trendValue = value;
            }

            if (!reliability && /(Рейтинг|Reliability|Над[іi]йн[іi]ст[іi])/i.test(label)) {
              const pct = parsePercentFromText(value);
              if (pct) reliability = pct;
            }
          }
        }

        // Strategy section bullet list
        const mTrading = line.match(/^\-\s*(?:Тип торг(?:ов|і)л[иі]|Trading type)[:\s]+(.+)$/i);
        if (mTrading && !tradingType) tradingType = mTrading[1].trim();
        const mStrat = line.match(/^\-\s*(?:Стратег(?:ия|ія)|Strategy)[:\s]+(.+)$/i);
        if (mStrat && !strategy) strategy = mStrat[1].trim();
      }
    }

    const isUp = /Uptrend/i.test(trendValue);
    const isDown = /Downtrend/i.test(trendValue);

    const side = isUp
      ? (currentLanguage === 'en' ? 'LONG' : 'ЛОНГ')
      : isDown
        ? (currentLanguage === 'en' ? 'SHORT' : 'ШОРТ')
        : '';

    const timeframe = getUiTimeframe();
    const timeframeLabel = timeframe ? (t(timeframe) || timeframe) : '';
    const metaParts = [tradingType, strategy, timeframeLabel].map(s => String(s || '').trim()).filter(Boolean);
    const meta = normalizeMetaText(metaParts.join(' • '));

    return { side, reliability, meta };
  }

  function isForecastSectionTitle(title) {
    const t0 = String(title || '');
    return /\bForecast\b/i.test(t0) || /Прогноз/i.test(t0) || /прогноз/i.test(t0);
  }

  function renderForecastCard(title, contentLines) {
    const joined = (contentLines || []).map(s => String(s || '').trim()).filter(Boolean);
    let cases = '';
    let success = '';
    let profit = '';
    let range = '';
    let rangeMinPct = null;
    let rangeMaxPct = null;

    const titleText = String(title || '').replace(/^📊\s*/, '').trim();

    for (const l of joined) {
      const mCases = l.match(/(?:Анализ|Аналіз|Analysis)\s+(\d+)/i);
      if (mCases) cases = mCases[1];
      if (!success && /(Ймовірність|Вероятность|Probability)/i.test(l)) success = parsePercentFromText(l) || '';
      if (!profit && /(Очікуваний|Ожидаемая|Expected)/i.test(l)) {
        const mp = l.match(/([+\-]?[0-9]+(?:[\.,][0-9]+)?)\s*%/);
        if (mp) profit = mp[1];
      }
      if (!range && /(Діапазон|Диапазон|Range)/i.test(l)) {
        // Try to parse percent range and convert to absolute price range (like demo)
        const matches = Array.from(String(l).matchAll(/([+\-]?[0-9]+(?:[\.,][0-9]+)?)\s*%/g)).map(m => m[1]);
        if (matches.length >= 2) {
          const a = Number(String(matches[0]).replace(',', '.'));
          const b = Number(String(matches[1]).replace(',', '.'));
          if (Number.isFinite(a) && Number.isFinite(b)) {
            rangeMinPct = Math.min(a, b);
            rangeMaxPct = Math.max(a, b);
          }
        }
        range = l.split(':').slice(1).join(':').trim() || l;
      }
    }

    const fmtNum = (v) => {
      const s = String(v || '').trim();
      if (!s) return '';
      if (currentLanguage === 'uk') return s.replace('.', ',');
      return s;
    };

    const labelAnalysis = currentLanguage === 'uk' ? 'Аналіз:' : currentLanguage === 'en' ? 'Analysis:' : 'Анализ:';
    const labelCases1 = currentLanguage === 'uk' ? 'подібних ситуацій' : currentLanguage === 'en' ? 'similar cases' : 'похожих ситуаций';
    const labelCases2 = currentLanguage === 'uk' ? 'в історії' : currentLanguage === 'en' ? 'in history' : 'в истории';
    const labelProb = currentLanguage === 'uk' ? 'Ймовірність успіху:' : currentLanguage === 'en' ? 'Success probability:' : 'Вероятность успеха:';
    const labelProfit = currentLanguage === 'uk' ? 'Очікуваний прибуток:' : currentLanguage === 'en' ? 'Expected profit:' : 'Ожидаемая прибыль:';
    const labelRange = currentLanguage === 'uk' ? 'Діапазон можливих результатів:' : currentLanguage === 'en' ? 'Range of possible results:' : 'Диапазон возможных результатов:';

    let rangeDisplay = range;
    try {
      const base = Number((currentAnalysis && currentAnalysis.entry_price) || lastPrice || (Array.isArray(priceHistory) ? priceHistory[priceHistory.length - 1] : null));
      if (Number.isFinite(base) && rangeMinPct !== null && rangeMaxPct !== null) {
        const minPrice = base * (1 + rangeMinPct / 100);
        const maxPrice = base * (1 + rangeMaxPct / 100);
        const locale = currentLanguage === 'en' ? 'en-US' : (currentLanguage === 'uk' ? 'uk-UA' : 'ru-RU');
        const fmt = (v) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        rangeDisplay = `${fmt(minPrice)} – ${fmt(maxPrice)}`;
      }
    } catch (e) {
      // ignore
    }

    const parts = [];
    if (cases) {
      parts.push(`<div style="margin: 4px 0;"><span style="font-weight:700;">${escapeHtml(labelAnalysis)}</span> ${escapeHtml(cases)} ${escapeHtml(labelCases1)} ${escapeHtml(labelCases2)}</div>`);
    }
    if (success) {
      parts.push(`<div style="margin: 4px 0;"><span style="font-weight:700;">${escapeHtml(labelProb)}</span> ${escapeHtml(fmtNum(success))}%</div>`);
    }
    if (profit) {
      parts.push(`<div style="margin: 4px 0;"><span style="font-weight:700;">${escapeHtml(labelProfit)}</span> ${escapeHtml(fmtNum(profit))}%</div>`);
    }
    if (range) {
      parts.push(`<div style="margin: 4px 0;"><span style="font-weight:700;">${escapeHtml(labelRange)}</span> ${escapeHtml(rangeDisplay)}</div>`);
    }

    return `
      <div class="card forecast-card">
        <div class="report-text">${parts.join('')}</div>
      </div>
    `;
  }

  // Header block
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("=== ") && line.endsWith(" ===")) header.title = line.replace(/===|=/g, "").trim();
    else if (line.includes('Сгенерировано:') || line.includes('Generated:') || line.includes('Згенеровано:')) {
      const generatedMatch = line.match(/(?:Сгенерировано|Generated|Згенеровано)[:\s]+(.+)/i);
      if (generatedMatch) header.generated = generatedMatch[1].trim();
    }
    else if (/Текущий рынок|Current market|Поточний ринок/i.test(line)) {
      const marketMatch = line.match(/(?:Текущий рынок|Current market|Поточний ринок)[:\s]+(.+)/i);
      if (marketMatch) header.bias = marketMatch[1].trim();
    }
    if (line.startsWith("### ")) break;
    i++;
  }
  // Sections collection
  const sections = [];
  let current = null;
  let buffer = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      if (current) sections.push({ title: current, content: buffer.slice() });
      current = line.replace("### ", "").trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (current) sections.push({ title: current, content: buffer.slice() });

  // Extract header extras after we have all sections
  try {
    const extras = extractHeaderExtras(sections);
    header.side = extras.side;
    header.reliability = extras.reliability;
    header.meta = extras.meta;
  } catch (e) {
    // ignore
  }

  // Build HTML
  let html = '<div class="report">';
  const titleRaw = header.title || '';
  const symbolMatch = titleRaw.match(/([A-Z0-9]+\/[A-Z0-9]+)/);
  const symbolFromTitle = symbolMatch ? symbolMatch[1] : '';
  const titleLooksGeneric = /Аналитич(?:еский|ний)\s+отч[её]т|Analytical\s+Report/i.test(titleRaw);
  const titleText = titleLooksGeneric && symbolFromTitle
    ? `${t('report_title_default')} ${t('report_title_for')} ${symbolFromTitle}`
    : (titleRaw || t('report_title'));
  const generatedLabel = currentLanguage === 'uk' ? 'Згенеровано:' : (currentLanguage === 'en' ? 'Generated:' : 'Сгенерировано:');
  const relLabel = currentLanguage === 'uk' ? 'Рейтинг надійності:' : currentLanguage === 'en' ? 'Reliability rating:' : 'Рейтинг надежности:';
  html += `<div class="demo-report-top">`;
  html += `<div class="demo-report-title">${escapeHtml(titleText)}</div>`;
  if (header.generated) {
    html += `<div class="demo-report-generated">${escapeHtml(generatedLabel)} ${escapeHtml(formatGeneratedDate(header.generated))}</div>`;
  }
  if (header.side) {
    html += `<div class="demo-report-direction">${escapeHtml(header.side)}</div>`;
  }
  if (header.reliability) {
    html += `<div class="demo-report-reliability">${escapeHtml(relLabel)} ${escapeHtml(String(header.reliability).replace('.', currentLanguage === 'uk' ? ',' : '.'))}%</div>`;
  }
  if (header.meta) {
    html += `<div class="demo-report-mode">${escapeHtml(normalizeMetaText(header.meta))}</div>`;
  }
  html += `</div>`;

  sections.forEach(sec => {
    const title = sec.title;
    const content = (sec.content || []).filter(l => {
      const s = String(l || '');
      return !/(?:\ud83d\udd04\s*)?(?:запуст(?:ить|ити)\s+)?(?:(?:сравн\w*|порівняльн\w*|comparative)\s+)?(?:б[еэ]ктест|backtest)\b.*(?:стратег\w*|strateg\w*)/i.test(s);
    });
    const isRiskReward = /(R:R|risk\s*[:/\-]?\s*reward|соотношение\s+риск\s*\/\s*прибыл|співвідношення\s+ризик\s*[:/\-]?\s*прибут)/i.test(String(title || ''));
    // Detect and convert tables in-place
    let cardsHtml = "";
    // Special handling for Levels section: split Long/Short blocks
    const levelsTitleRu = '🎯 Уровни';
    const levelsTitleEn = '🎯 Levels';
    const levelsTitleUk = '🎯 Рівні';
    if (isForecastSectionTitle(title)) {
      cardsHtml += renderForecastCard(title, content);
    } else if (title.includes(levelsTitleRu) || title.includes(levelsTitleEn) || title.includes(levelsTitleUk) || /🎯.*[Уу]ровн/i.test(title)) {
      const tableLines = content.filter(l => String(l).includes('|'));

      const parseTableLine = (line) => {
        const parts = String(line || '').split('|').map(c => c.trim());
        if (parts.length && parts[0] === '') parts.shift();
        if (parts.length && parts[parts.length - 1] === '') parts.pop();
        return parts;
      };

      const renderTextBlock = (lines) => {
        const text = (lines || []).map(s => String(s || '').trim()).filter(Boolean).join('\n');
        if (!text) return '';
        const safe = escapeHtml(text).replace(/\n/g, '<br>');
        return `<div class="report-text">${safe}</div>`;
      };

      // Case 1: table with Long/Short columns
      if (tableLines.length >= 2) {
        const headerLine = tableLines[0];
        const headerCells = parseTableLine(headerLine);
        const longColIndex = headerCells.findIndex(h => /long|лонг/i.test(h));
        const shortColIndex = headerCells.findIndex(h => /short|шорт/i.test(h));
        const paramColIndex = headerCells.findIndex(h => !/long|short|лонг|шорт/i.test(h) && h.length > 0);

        if (longColIndex >= 0 && shortColIndex >= 0 && paramColIndex >= 0) {
          const dataLines = tableLines.slice(1).filter(l => !/^[-|\s]+$/.test(String(l).trim()));
          const longTableLines = [`| ${headerCells[paramColIndex]} | ${headerCells[longColIndex]} |`, '|---|---|'];
          const shortTableLines = [`| ${headerCells[paramColIndex]} | ${headerCells[shortColIndex]} |`, '|---|---|'];
          for (const dl of dataLines) {
            const cells = parseTableLine(dl);
            if (cells.length > Math.max(paramColIndex, longColIndex)) {
              longTableLines.push(`| ${cells[paramColIndex] || ''} | ${cells[longColIndex] || ''} |`);
            }
            if (cells.length > Math.max(paramColIndex, shortColIndex)) {
              shortTableLines.push(`| ${cells[paramColIndex] || ''} | ${cells[shortColIndex] || ''} |`);
            }
          }

          const longHtml = mdTableToHtml(longTableLines) || renderTextBlock(content);
          const shortHtml = mdTableToHtml(shortTableLines) || renderTextBlock(content);
          cardsHtml += `<div class="subcards">`;
          cardsHtml += `<div class="card"><div class="card-title">Лонг</div>${longHtml}</div>`;
          cardsHtml += `<div class="card"><div class="card-title">Шорт</div>${shortHtml}</div>`;
          cardsHtml += `</div>`;
        }
      }

      // Case 2: **Лонг**/**Шорт** blocks
      if (!cardsHtml) {
        const joined = content.join("\n");
        const parts = joined.split(/\*\*Шорт\*\*/i);
        const longPart = parts[0].split(/\*\*Лонг\*\*/i)[1] || "";
        const shortPart = parts[1] || "";
        const longLines = longPart.trim().split("\n").filter(Boolean);
        const shortLines = shortPart.trim().split("\n").filter(Boolean);
        cardsHtml += `<div class="subcards">`;
        if (longLines.length) {
          const tblLines = longLines.filter(l => l.includes("|"));
          const body = tblLines.length ? (mdTableToHtml(tblLines) || '') : renderTextBlock(longLines);
          cardsHtml += `<div class="card"><div class="card-title">Лонг</div>${body}</div>`;
        }
        if (shortLines.length) {
          const tblLines = shortLines.filter(l => l.includes("|"));
          const body = tblLines.length ? (mdTableToHtml(tblLines) || '') : renderTextBlock(shortLines);
          cardsHtml += `<div class="card"><div class="card-title">Шорт</div>${body}</div>`;
        }
        cardsHtml += `</div>`;
      }
    } else if (isRiskReward) {
      const joined = content.map(s => String(s || '')).join("\n");
      const mLong = joined.match(/(?:\*\*)?\b(?:Long|Лонг)\b(?:\s*:\s*)?(?:\*\*)?\s*([0-9]+(?:[\.,][0-9]+)?)/i);
      const mShort = joined.match(/(?:\*\*)?\b(?:Short|Шорт)\b(?:\s*:\s*)?(?:\*\*)?\s*([0-9]+(?:[\.,][0-9]+)?)/i);
      if (mLong || mShort) {
        const longLabel = t('report_long');
        const shortLabel = t('report_short');
        const fmt = (v) => {
          const s = String(v || '').trim();
          if (!s) return '-';
          return currentLanguage === 'uk' ? s.replace('.', ',') : s;
        };
        cardsHtml += `
          <div class="rr-grid">
            <div class="rr-item"><div class="rr-label">${escapeHtml(longLabel)}</div><div class="rr-value">${escapeHtml(fmt(mLong ? mLong[1] : ''))}</div></div>
            <div class="rr-item"><div class="rr-label">${escapeHtml(shortLabel)}</div><div class="rr-value">${escapeHtml(fmt(mShort ? mShort[1] : ''))}</div></div>
          </div>
        `;
      } else if (content.some(l => l.includes("|"))) {
        const tableLines = content.filter(l => l.includes("|"));
        cardsHtml += mdTableToHtml(tableLines) || '';
      } else {
        const text = content.join("\n").trim();
        if (text) {
          let processedText = text;
          processedText = processedText.replace(/\[DIVIDER\]/g, '___DIVIDER_MARKER___');
          processedText = processedText.replace(/:\s*\n/g, ': ');
          processedText = processedText.replace(/\*\*(.*?)\*\*/g, '___STRONG_START___$1___STRONG_END___');
          processedText = escapeHtml(processedText);
          processedText = processedText.replace(/___DIVIDER_MARKER___/g, '<div class="backtest-divider"></div>');
          processedText = processedText.replace(/___STRONG_START___(.*?)___STRONG_END___/g, '<strong>$1</strong>');
          processedText = processedText.split('\n').map(line => {
            line = line.trim();
            if (!line) return '';
            return `<div style="margin: 4px 0;">${line}</div>`;
          }).join('');
          cardsHtml += `<div class="report-text">${processedText}</div>`;
        }
      }
    } else if (content.some(l => l.includes("|"))) {
      const tableLines = content.filter(l => l.includes("|"));
      cardsHtml += mdTableToHtml(tableLines) || '';
    } else if (/^- /.test(content.join("\n"))) {
      // bullet list
      const items = content
        .filter(l => l.trim().startsWith("- "))
        .map(l => l.trim().slice(2))
        .map(it => {
          const s = String(it || '');
          const replaced = s.replace(/\bALL\b/g, t('value_all')).replace(/\bNONE\b/g, t('value_none'));
          return replaced;
        });
      cardsHtml += '<ul class="report-list">' + items.map(it => `<li>${escapeHtml(it)}</li>`).join("") + "</ul>";
    } else {
      const text = content.join("\n").trim();
      if (text) {
        // Обрабатываем специальные маркеры
        let processedText = text;
        processedText = processedText.replace(/\[DIVIDER\]/g, '___DIVIDER_MARKER___');
        processedText = processedText.replace(/:\s*\n/g, ': ');
        processedText = processedText.replace(/\*\*(.*?)\*\*/g, '___STRONG_START___$1___STRONG_END___');
        processedText = escapeHtml(processedText);
        processedText = processedText.replace(/___DIVIDER_MARKER___/g, '<div class="backtest-divider"></div>');
        processedText = processedText.replace(/___STRONG_START___(.*?)___STRONG_END___/g, '<strong>$1</strong>');
        processedText = processedText.split('\n').map(line => {
          line = line.trim();
          if (!line) return '';
          return `<div style="margin: 4px 0;">${line}</div>`;
        }).join('');
        cardsHtml += `<div class="report-text">${processedText}</div>`;
      }
    }
    html += `<div class="section"><div class="section-title">${escapeHtml(title)}</div>${cardsHtml}</div>`;
  });

  html += "</div>";
  return html;
}

document.addEventListener("DOMContentLoaded", () => {
  // === Подтверждения (чекбоксы) ===
  window.__confirmationUi = setupConfirmationCheckboxUi({
    hiddenInputId: 'confirmation',
    modeRadioName: 'confirmationMode',
    indicatorsContainerId: 'confirmationIndicators',
    defaultValue: 'NONE'
  });

  window.__autoSignalConfirmationUi = setupConfirmationCheckboxUi({
    hiddenInputId: 'autoSignalConfirmation',
    modeRadioName: 'autoSignalConfirmationMode',
    indicatorsContainerId: 'autoSignalConfirmationIndicators',
    defaultValue: 'NONE'
  });

  // ✅ Инициализируем график при загрузке страницы
  const chartContainer = document.getElementById('realtimeChartContainer');
  if (chartContainer) {
    chartContainer.style.display = 'block';
  }
  
  // ✅ ИСПРАВЛЕНО: Инициализируем график с проверкой загрузки Chart.js
  if (typeof Chart !== 'undefined') {
    initRealtimeChart();
    
    // ✅ Автоматически загружаем график с символом из формы
    if (realtimeChart) {
      // ✅ ИСПРАВЛЕНО: Используем таймфрейм по умолчанию, если chartTimeframe не найден
      const chartTimeframeSelect = document.getElementById('chartTimeframe');
      const defaultSymbol = getActiveSymbolForChart();
      const defaultTimeframe = chartTimeframeSelect?.value || '1h';
      console.log('📊 Автоматическая загрузка графика:', defaultSymbol, defaultTimeframe);
      // Загружаем график через небольшую задержку, чтобы Chart.js успел инициализироваться
      setTimeout(() => {
        if (typeof connectWebSocket === 'function' && realtimeChart) {
          connectWebSocket(defaultSymbol, defaultTimeframe);
        } else {
          console.warn('⚠️ Функция connectWebSocket еще не определена или график не инициализирован');
        }
      }, 200);
    }
  } else {
    // ✅ ИСПРАВЛЕНО: Ждем загрузки Chart.js
    console.warn('⚠️ Chart.js еще не загружен, ждем...');
    let chartLoadAttempts = 0;
    const checkChart = setInterval(() => {
      chartLoadAttempts++;
      if (typeof Chart !== 'undefined') {
        clearInterval(checkChart);
        initRealtimeChart();
        if (realtimeChart) {
          const chartTimeframeSelect = document.getElementById('chartTimeframe');
          const defaultSymbol = getActiveSymbolForChart();
          const defaultTimeframe = chartTimeframeSelect?.value || '1h';
          setTimeout(() => {
            if (typeof connectWebSocket === 'function') {
              connectWebSocket(defaultSymbol, defaultTimeframe);
            }
          }, 200);
        }
      } else if (chartLoadAttempts > 50) {
        clearInterval(checkChart);
        console.error('❌ Chart.js не загрузился за 5 секунд');
      }
    }, 100);
  }
  
  const tradingType = document.getElementById("trading_type");
  const tfInfo = document.getElementById("tfInfo");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const progress = document.getElementById("progressBar");
  const progressBar = progress ? progress.querySelector(".bar") : null;
  const result = document.getElementById("result");
  const reportText = document.getElementById("reportText");
  const downloadBtn = document.getElementById("downloadZip");
  const downloadStatsBtn = document.getElementById("downloadStats");
  const exportTradingViewBtn = document.getElementById("exportTradingView");
  const loadStrategyAnalysisBtn = document.getElementById("loadStrategyAnalysis");
  const strategyAnalysisDiv = document.getElementById("strategyAnalysis");
  const logoutBtn = document.getElementById("logoutBtn");
  const demoReportEl = document.getElementById("demoReport");
  const toggleAdvanced = document.getElementById("toggleAdvanced");
  const advancedSettings = document.getElementById("advancedSettings");
  const toggleIcon = document.getElementById("toggleIcon");
  const smartCombineBtn = document.getElementById("smartCombineBtn");
  const enableForecast = document.getElementById("enableForecast");
  const enableBacktest = document.getElementById("enableBacktest");
  const enableML = document.getElementById("enableML");

  // === Logout ===
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        localStorage.removeItem("rememberedUser");
        window.location.href = "/login";
      } catch (err) {
        console.error("Ошибка logout:", err);
        alert("Ошибка при выходе");
      }
    });
  }
  
  // Загрузка настроек уведомлений и торговли
  async function loadNotificationAndTradingSettings() {
    try {
      const res = await fetch('/api/get_notification_settings');
      if (res.ok) {
        const settings = await res.json();
        const enableEmailNotifications = document.getElementById('enableEmailNotifications');
        const enableTelegramNotifications = document.getElementById('enableTelegramNotifications');
        const telegramChatId = document.getElementById('telegramChatId');
        const exchangeSpread = document.getElementById('exchangeSpread');
        
        if (enableEmailNotifications) {
          enableEmailNotifications.checked = settings.enable_email || false;
        }
        if (enableTelegramNotifications) {
          enableTelegramNotifications.checked = settings.enable_telegram || false;
        }
        if (telegramChatId && settings.telegram_chat_id) {
          telegramChatId.value = settings.telegram_chat_id;
        }
        if (exchangeSpread && settings.exchange_spread !== undefined) {
          exchangeSpread.value = settings.exchange_spread || 0;
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
    }
  }
  
  // === Настройки ===
  // ✅ ИСПРАВЛЕНО: Прямая инициализация кнопок настроек
  function initSettingsButtonsDirect() {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsScreen = document.getElementById("settingsScreen");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    
    console.log('🔍 Отладка кнопок настроек:', {
      settingsBtn: !!settingsBtn,
      settingsScreen: !!settingsScreen,
      closeSettingsBtn: !!closeSettingsBtn
    });
  
  if (settingsBtn && settingsScreen) {
      console.log('✅ Инициализация кнопки настроек');
      
      // ✅ ИСПРАВЛЕНО: Убираем preventDefault, чтобы не блокировать события
      settingsBtn.onclick = function(e) {
        console.log('🔘 Кнопка настроек кликнута');
        e.stopPropagation();
      settingsScreen.classList.remove("hidden");
      // Загружаем все настройки при открытии
        if (typeof loadAutoSignalsSettings === 'function') {
      loadAutoSignalsSettings();
        }
      loadNotificationAndTradingSettings();
        return false;
      };
      
      // Также добавляем обработчик через addEventListener для надежности
      settingsBtn.addEventListener("click", function(e) {
        console.log('🔘 Кнопка настроек кликнута (addEventListener)');
        e.stopPropagation();
        settingsScreen.classList.remove("hidden");
        if (typeof loadAutoSignalsSettings === 'function') {
          loadAutoSignalsSettings();
        }
        loadNotificationAndTradingSettings();
      }, true); // Используем capture phase
  }
  
  if (closeSettingsBtn && settingsScreen) {
      closeSettingsBtn.onclick = function(e) {
        console.log('🔘 Кнопка закрытия настроек нажата');
        e.stopPropagation();
      settingsScreen.classList.add("hidden");
        return false;
      };
  }
  
  // Закрытие настроек при клике вне экрана
  if (settingsScreen) {
    settingsScreen.addEventListener("click", (e) => {
      if (e.target === settingsScreen) {
        settingsScreen.classList.add("hidden");
      }
    });
    }
  }
  
  // Инициализация с повторными попытками
  function tryInitSettingsButtons(attempts = 0) {
    const maxAttempts = 10;
    const settingsBtn = document.getElementById("settingsBtn");
    
    if (settingsBtn) {
      initSettingsButtonsDirect();
      console.log('✅ Кнопки настроек успешно инициализированы');
    } else if (attempts < maxAttempts) {
      console.log(`🔄 Попытка инициализации кнопок настроек ${attempts + 1}/${maxAttempts}...`);
      setTimeout(() => tryInitSettingsButtons(attempts + 1), 300);
    } else {
      console.error('❌ Не удалось инициализировать кнопки настроек после всех попыток');
    }
  }
  
  // Первая попытка с небольшой задержкой
  tryInitSettingsButtons();

  // === Таймфреймы ===
  const timeframes = {
    "scalping": "5m",
    "daytrading": "1h",
    "swing": "4h",
    "medium_term": "1d",
    "long_term": "1w"
  };
  
  // Маппинг для обратной совместимости (старые значения)
  const tradingTypeMap = {
    "Скальпинг": "scalping",
    "Дейтрейдинг": "daytrading",
    "Свинг": "swing",
    "Среднесрочная": "medium_term",
    "Долгосрочная": "long_term"
  };

  // === Время показа линий анализа по типу торговли ===
  const linesDisplayDuration = {
    "scalping": 5 * 60 * 1000,      // 5 минут
    "daytrading": 15 * 60 * 1000,   // 15 минут
    "swing": 30 * 60 * 1000,         // 30 минут
    "medium_term": 60 * 60 * 1000, // 1 час
    "long_term": 2 * 60 * 60 * 1000 // 2 часа
  };

  const timeframeSelect = document.getElementById("timeframe");

  // Обновляем рекомендуемый таймфрейм при изменении типа торговли
  if (tradingType && tfInfo) {
    tradingType.addEventListener("change", () => {
      const tradingTypeValue = tradingType.value;
      const recommendedTf = timeframes[tradingTypeValue] || "1h";
      tfInfo.textContent = t("recommended") + ": " + recommendedTf;
      
      // Если выбран "Автоматически", обновляем текст, но не меняем значение
      if (timeframeSelect && timeframeSelect.value === "auto") {
        // Значение остается "auto", но показываем рекомендацию
      }
    });
  }

  // Обновляем информацию при изменении выбранного таймфрейма
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", () => {
      if (timeframeSelect.value === "auto") {
        if (tradingType && tfInfo) {
          const tradingTypeValue = tradingType.value;
          const recommendedTf = timeframes[tradingTypeValue] || "1h";
          tfInfo.textContent = t("recommended") + ": " + recommendedTf;
        }
      } else {
        if (tfInfo) {
          tfInfo.textContent = t("selected") + ": " + timeframeSelect.value;
        }
      }
    });
  }
  
  // === Инициализация кастомного дропдауна для языка ===
  function initCustomDropdown() {
    const dropdown = document.getElementById('languageDropdown');
    const toggle = document.getElementById('languageToggleBtn');
    const menu = document.getElementById('languageDropdownMenu');
    const toggleText = document.getElementById('languageToggleText');
  
    // ✅ ОТЛАДКА: Проверяем наличие элементов
    console.log('🔍 Отладка кнопки языка:', {
      dropdown: !!dropdown,
      toggle: !!toggle,
      menu: !!menu,
      toggleText: !!toggleText
    });
  
    if (!dropdown || !toggle || !menu) {
      console.error('❌ Элементы языка не найдены');
      return;
    }
    
    // Устанавливаем текущий язык
    const currentLang = localStorage.getItem('language') || 'ru';
    updateDropdownText(currentLang);
    
    // Отмечаем выбранный пункт
    menu.querySelectorAll('li').forEach(li => {
      if (li.getAttribute('data-value') === currentLang) {
        li.classList.add('selected');
      } else {
        li.classList.remove('selected');
      }
    });
    
    // ✅ ИСПРАВЛЕНО: Используем onclick для более надежной работы
    toggle.onclick = function(e) {
      console.log('🔘 Кнопка языка кликнута');
      e.stopPropagation();
      menu.classList.toggle('show');
      return false;
    };
    
    // Также добавляем обработчик через addEventListener для надежности
    toggle.addEventListener('click', function(e) {
      console.log('🔘 Кнопка языка кликнута (addEventListener)');
      e.stopPropagation();
      menu.classList.toggle('show');
    }, true); // Используем capture phase
    
    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        menu.classList.remove('show');
      }
    });
    
    // Выбор языка
    menu.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        const value = li.getAttribute('data-value');
        console.log('🌐 Выбран язык:', value);
        currentLanguage = value;
        localStorage.setItem('language', value);
        updateTranslations();
        updateDropdownText(value);
        menu.classList.remove('show');
        
        // Обновляем выбранный пункт
        menu.querySelectorAll('li').forEach(item => {
          item.classList.remove('selected');
        });
        li.classList.add('selected');
        
        // Обновляем информацию о таймфрейме после смены языка
        if (typeof updateTimeframeInfo === 'function') {
        updateTimeframeInfo();
        }
        
        // Обновляем язык на странице логина
        if (typeof updateLoginTranslations === 'function') {
          updateLoginTranslations();
        }
        
        // ✅ НОВОЕ: Перегенерируем отчет, если он уже был создан
        regenerateReportsOnLanguageChange();
      });
    });
    
    function updateDropdownText(lang) {
      const langMap = {
        'uk': 'UA',
        'en': 'EN',
        'ru': 'RU'
      };
      if (toggleText) {
        toggleText.textContent = langMap[lang] || '🌐';
      }
    }
    
    console.log('✅ Инициализация кнопки языка завершена');
  }
  
  // Инициализируем кастомный дропдаун
  // ✅ ИСПРАВЛЕНО: Добавляем задержку и повторные попытки для десктопного приложения
  function tryInitCustomDropdown(attempts = 0) {
    const maxAttempts = 10;
    const dropdown = document.getElementById('languageDropdown');
    const toggle = document.getElementById('languageToggleBtn');
    
    if (dropdown && toggle) {
  initCustomDropdown();
      console.log('✅ Кнопка языка успешно инициализирована');
    } else if (attempts < maxAttempts) {
      console.log(`🔄 Попытка инициализации кнопки языка ${attempts + 1}/${maxAttempts}...`);
      setTimeout(() => tryInitCustomDropdown(attempts + 1), 300);
    } else {
      console.error('❌ Не удалось инициализировать кнопку языка после всех попыток');
    }
  }
  
  // Первая попытка
  tryInitCustomDropdown();
  
  // Загружаем план пользователя
  fetch('/api/user_info', { credentials: 'include' })
    .then(res => {
        if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Ответ не является JSON");
      }
      return res.json();
    })
    .then(data => {
      userPlan = data.plan || 'free';
      
      // Отключаем элементы для Free плана вместо скрытия
      document.querySelectorAll('[data-plan]').forEach(el => {
        const requiredPlan = el.getAttribute('data-plan');
        if (userPlan === 'free' && requiredPlan !== 'free') {
          // Вместо скрытия - отключаем элементы
          if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
            el.disabled = true;
            el.classList.add('disabled-free');
            
            // Добавляем tooltip для кнопок статистики и анализа
            if (el.id === 'downloadStats' || el.id === 'loadStrategyAnalysis') {
              el.title = '🔒 Доступно только в Pro/Pro+';
              el.setAttribute('data-tooltip', '🔒 Доступно только в Pro/Pro+');
            }
          } else {
            // Для контейнеров отключаем все интерактивные элементы внутри
            const interactiveElements = el.querySelectorAll('button, input, select, textarea');
            interactiveElements.forEach(ie => {
              ie.disabled = true;
              ie.classList.add('disabled-free');
              
              // Добавляем tooltip для кнопок статистики и анализа
              if (ie.id === 'downloadStats' || ie.id === 'loadStrategyAnalysis') {
                ie.title = '🔒 Доступно только в Pro/Pro+';
                ie.setAttribute('data-tooltip', '🔒 Доступно только в Pro/Pro+');
              }
            });
            el.classList.add('disabled-free-container');
          }
        } else if (userPlan !== 'free') {
          // Включаем элементы для Pro/Pro+
          if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
            el.disabled = false;
            el.classList.remove('disabled-free');
            if (el.id === 'downloadStats' || el.id === 'loadStrategyAnalysis') {
              el.removeAttribute('title');
              el.removeAttribute('data-tooltip');
            }
          } else {
            const interactiveElements = el.querySelectorAll('button, input, select, textarea');
            interactiveElements.forEach(ie => {
              ie.disabled = false;
              ie.classList.remove('disabled-free');
              if (ie.id === 'downloadStats' || ie.id === 'loadStrategyAnalysis') {
                ie.removeAttribute('title');
                ie.removeAttribute('data-tooltip');
              }
            });
            el.classList.remove('disabled-free-container');
          }
        }
      });
      
      // Продвинутые настройки - не скрываем, но отключаем для Free
      if (userPlan === 'free') {
        const advancedSettings = document.getElementById('advancedSettings');
        const toggleAdvanced = document.getElementById('toggleAdvanced');
        
        if (toggleAdvanced) {
          toggleAdvanced.disabled = true;
          toggleAdvanced.classList.add('disabled-free');
          
          // Создаем тултип через модуль
          ProTooltipManager.create(toggleAdvanced);
        }
        
        if (advancedSettings) {
          // Отключаем все интерактивные элементы внутри продвинутых настроек
          const interactiveElements = advancedSettings.querySelectorAll('button, input, select, textarea');
          interactiveElements.forEach(ie => {
            ie.disabled = true;
            ie.classList.add('disabled-free');
          });
          advancedSettings.classList.add('disabled-free-container');
        }
      } else {
        // Включаем для Pro/Pro+
        const advancedSettings = document.getElementById('advancedSettings');
        const toggleAdvanced = document.getElementById('toggleAdvanced');
        
        if (toggleAdvanced) {
          toggleAdvanced.disabled = false;
          toggleAdvanced.classList.remove('disabled-free');
          
          // Удаляем тултип через модуль
          ProTooltipManager.remove(toggleAdvanced);
        }
        
        if (advancedSettings) {
          const interactiveElements = advancedSettings.querySelectorAll('button, input, select, textarea');
          interactiveElements.forEach(ie => {
            ie.disabled = false;
            ie.classList.remove('disabled-free');
          });
          advancedSettings.classList.remove('disabled-free-container');
        }
      }
      
      // Для кнопок статистики и анализа - используем модуль тултипов
        const downloadStatsBtn = document.getElementById('downloadStats');
        const loadStrategyAnalysisBtn = document.getElementById('loadStrategyAnalysis');
        
      if (userPlan === 'free') {
        // Для кнопки статистики - создаем тултип
        if (downloadStatsBtn) {
          ProTooltipManager.create(downloadStatsBtn);
        }
        
        // Для кнопки анализа стратегий - создаем тултип
        if (loadStrategyAnalysisBtn) {
          ProTooltipManager.create(loadStrategyAnalysisBtn);
        }
      } else {
        // Удаляем тултипы для Pro пользователей
        if (downloadStatsBtn) {
          ProTooltipManager.remove(downloadStatsBtn);
        }
        if (loadStrategyAnalysisBtn) {
          ProTooltipManager.remove(loadStrategyAnalysisBtn);
        }
      }
    })
    .catch(err => {
      console.error('Ошибка загрузки информации о пользователе:', err);
      userPlan = 'free'; // По умолчанию Free
    });
  
  // Применяем переводы при загрузке
  updateTranslations();
  
  // Инициализируем рекомендуемый таймфрейм ПОСЛЕ загрузки переводов
  updateTimeframeInfo();

  // === Продвинутые настройки: раскрытие/сворачивание ===
  // ИСПРАВЛЕНО: Инициализируем ПОСЛЕ загрузки информации о плане пользователя
  // Но обработчик должен работать всегда, даже для Free плана (просто показывать тултип)
  if (toggleAdvanced && advancedSettings && toggleIcon) {
    // Функция обновления иконки в зависимости от состояния
    function updateToggleIcon() {
      const isHidden = advancedSettings.classList.contains("hidden");
      if (isHidden) {
        toggleIcon.textContent = "🔽";
        toggleAdvanced.classList.remove("expanded");
      } else {
        toggleIcon.textContent = "🔼";
        toggleAdvanced.classList.add("expanded");
      }
    }
    
    // Восстанавливаем состояние из localStorage
    const savedState = localStorage.getItem("advancedSettingsExpanded");
    if (savedState === "true") {
      advancedSettings.classList.remove("hidden");
    } else {
      advancedSettings.classList.add("hidden");
    }
    updateToggleIcon();

    // ИСПРАВЛЕНО: Обработчик должен работать всегда, но проверяем disabled ПЕРЕД действием
    toggleAdvanced.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Проверяем, не отключен ли элемент для Free плана
      if (toggleAdvanced.disabled || toggleAdvanced.classList.contains('disabled-free')) {
        // Для Free плана просто показываем тултип, но не открываем настройки
        return;
      }
      
      const isHidden = advancedSettings.classList.contains("hidden");
      if (isHidden) {
        advancedSettings.classList.remove("hidden");
        localStorage.setItem("advancedSettingsExpanded", "true");
      } else {
        advancedSettings.classList.add("hidden");
        localStorage.setItem("advancedSettingsExpanded", "false");
      }
      updateToggleIcon();
    });
  } else {
    console.warn("Advanced settings elements not found:", { 
      toggleAdvanced: !!toggleAdvanced, 
      advancedSettings: !!advancedSettings, 
      toggleIcon: !!toggleIcon 
    });
  }

  // === Показ/скрытие поля периода бэктеста ===
  const backtestPeriod = document.getElementById("backtestPeriod");
  
  if (enableBacktest && backtestPeriod) {
    enableBacktest.addEventListener("change", () => {
      if (enableBacktest.checked) {
        backtestPeriod.classList.remove("hidden");
      } else {
        backtestPeriod.classList.add("hidden");
      }
    });
  }

  // === Показ/скрытие настроек трейлинга ===
  const enableTrailing = document.getElementById("enableTrailing");
  const trailingSettings = document.getElementById("trailingSettings");
  
  if (enableTrailing && trailingSettings) {
    enableTrailing.addEventListener("change", () => {
      if (enableTrailing.checked) {
        trailingSettings.classList.remove("hidden");
      } else {
        trailingSettings.classList.add("hidden");
      }
    });
  }

  // === Настройки уведомлений (закомментировано - не нужны при ручном запуске анализа) ===
  // Раскомментируйте этот блок, если добавите автоматический мониторинг рынка в фоне
  /*
  // === Загрузка настроек уведомлений из БД ===
  async function loadNotificationSettings() {
    try {
      const res = await fetch("/api/get_notification_settings");
      if (res.ok) {
        const settings = await res.json();
        if (settings.enable_email !== undefined) {
          const enableEmail = document.getElementById("enableEmail");
          if (enableEmail) enableEmail.checked = settings.enable_email;
        }
        if (settings.alert_min_reliability !== undefined) {
          const alertMinReliability = document.getElementById("alertMinReliability");
          if (alertMinReliability) alertMinReliability.value = settings.alert_min_reliability;
        }
      }
    } catch (err) {
      console.warn("Не удалось загрузить настройки уведомлений:", err);
    }
  }

  // Загружаем настройки при загрузке страницы
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNotificationSettings);
  } else {
    loadNotificationSettings();
  }

  // === Сохранение настроек уведомлений ===
  function saveNotificationSettings() {
    const enableEmail = document.getElementById("enableEmail")?.checked || false;
    const alertMinReliability = parseFloat(document.getElementById("alertMinReliability")?.value || 60);

    fetch("/api/save_notification_settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enable_email: enableEmail,
        alert_min_reliability: alertMinReliability
      })
    }).catch(err => console.warn("Не удалось сохранить настройки:", err));
  }

  // Сохраняем настройки при изменении
  const enableEmailEl = document.getElementById("enableEmail");
  if (enableEmailEl) {
    enableEmailEl.addEventListener("change", saveNotificationSettings);
  }
  const alertMinReliabilityEl = document.getElementById("alertMinReliability");
  if (alertMinReliabilityEl) {
    alertMinReliabilityEl.addEventListener("change", saveNotificationSettings);
  }
  */

  // Остановка WebSocket при закрытии страницы
  window.addEventListener('beforeunload', () => {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  });

  // === Динамическое позиционирование tooltip'ов ===
  document.querySelectorAll('.info').forEach(infoEl => {
    infoEl.addEventListener('mouseenter', function() {
      const tooltip = this;
      
      // Используем requestAnimationFrame для получения актуальных размеров
      requestAnimationFrame(() => {
        const rect = tooltip.getBoundingClientRect();
        const tooltipWidth = 320; // max-width из CSS
        const iconCenterX = rect.left + (rect.width / 2);
        const tooltipLeft = iconCenterX - (tooltipWidth / 2);
        const tooltipRight = tooltipLeft + tooltipWidth;
        const windowWidth = window.innerWidth;
        const padding = 15;
        
        let offset = 0;
        
        // Если tooltip выходит за левую границу
        if (tooltipLeft < padding) {
          offset = padding - tooltipLeft;
        } 
        // Если tooltip выходит за правую границу
        else if (tooltipRight > windowWidth - padding) {
          offset = (windowWidth - padding - tooltipRight);
        }
        
        tooltip.style.setProperty('--tooltip-offset', `${offset}px`);
        tooltip.style.setProperty('--tooltip-top', `${rect.top - 5}px`);
      });
    });
  });

  // Делаем кликабельными чекбоксы через родительский контейнер
  if (enableForecast) {
    const forecastOption = enableForecast.closest(".advanced-option");
    if (forecastOption) {
      forecastOption.style.cursor = "pointer";
      forecastOption.addEventListener("click", (e) => {
        if (e.target !== enableForecast && e.target.tagName !== "SPAN" && e.target.tagName !== "DIV") {
          enableForecast.checked = !enableForecast.checked;
        }
      });
    }
  }
  
  if (enableBacktest) {
    const backtestOption = enableBacktest.closest(".advanced-option");
    if (backtestOption) {
      backtestOption.style.cursor = "pointer";
      backtestOption.addEventListener("click", (e) => {
        if (e.target !== enableBacktest && e.target.tagName !== "SPAN" && e.target.tagName !== "DIV") {
          enableBacktest.checked = !enableBacktest.checked;
        }
      });
    }
  }

  // === Smart Combine: автоподбор индикаторов ===
  if (smartCombineBtn) {
    smartCombineBtn.addEventListener("click", async () => {
      const symbol = document.getElementById("symbol").value;
      const trading_type = tradingType.value;
      const timeframe = timeframeSelect && timeframeSelect.value !== "auto" ? timeframeSelect.value : null;
      
      smartCombineBtn.disabled = true;
      smartCombineBtn.textContent = "⏳ Автоподбор запущен..";
      
      try {
        const res = await fetch("/api/smart_combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            symbol, 
            trading_type,
            timeframe: timeframe  // Передаем выбранный таймфрейм (null если "auto")
          })
        });
        
        const data = await res.json();
        
        if (res.ok && data.indicators) {
          const indicatorValue = data.indicators.join("+");

          // Если вёрстка уже на чекбоксах — применяем туда
          if (window.__confirmationUi && typeof window.__confirmationUi.applyValue === 'function') {
            window.__confirmationUi.applyValue(indicatorValue);
          } else {
            // Фолбек на старый select
            const confirmationSelect = document.getElementById("confirmation");
            if (confirmationSelect && confirmationSelect.tagName === 'SELECT') {
              let found = false;
              for (let option of confirmationSelect.options) {
                if (option.value === indicatorValue) {
                  confirmationSelect.value = indicatorValue;
                  found = true;
                  break;
                }
              }
              if (!found) {
                const newOption = document.createElement("option");
                newOption.value = indicatorValue;
                newOption.textContent = data.indicators.join(" + ");
                confirmationSelect.appendChild(newOption);
                confirmationSelect.value = indicatorValue;
              }
            } else {
              const hidden = document.getElementById('confirmation');
              if (hidden) hidden.value = indicatorValue;
            }
          }
          
          // Показываем результат под кнопкой (не исчезает до следующего запуска анализа)
          const indicatorNames = data.indicators.join(" + ");
          const resultEl = document.getElementById("smartCombineResult");
          if (resultEl) {
            resultEl.textContent = `Рекомендуемые индикаторы: ${indicatorNames}. Причина: ${data.reason}.`;
          }
          // Дополнительно показываем краткий toast
          showToast(`🎯 Автоподбор: ${indicatorNames}`, "success", 5000);
          
          // Подсвечиваем кнопку анализа для привлечения внимания
          if (analyzeBtn) {
            analyzeBtn.style.animation = "pulse 2s ease-in-out 3";
            setTimeout(() => {
              if (analyzeBtn) analyzeBtn.style.animation = "";
            }, 6000);
          }
        } else {
          showToast("⚠️ " + (data.error || "Не удалось определить оптимальные индикаторы"), "error");
        }
      } catch (err) {
        console.error("Ошибка Smart Combine:", err);
        showToast("❌ Ошибка при автоподборе индикаторов", "error");
      } finally {
        smartCombineBtn.disabled = false;
        smartCombineBtn.textContent = "🎯 Автоподбор индикаторов";
      }
    });
  }

  // === Toast уведомления ===
  function showToast(text, type = "success", duration = 3500) {
    const container = document.getElementById("toastContainer");
    if (!container) return alert(text);

    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = text;
    container.appendChild(t);

    setTimeout(() => t.classList.add("show"), 100);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // === Прогресс ===
  function startProgress() {
    progress.classList.remove("hidden");
    if (progressBar) progressBar.style.width = "100%";
  }

  function stopProgress() {
    if (progressBar) progressBar.style.width = "0%";
    progress.classList.add("hidden");
  }

  // === Рендер отчёта (Markdown-подобный → HTML-карточки) ===
  // ✅ Функции escapeHtml, mdTableToHtml и renderReport теперь определены глобально (выше)

  // === Рендер демо при загрузке ===
  if (demoReportEl && reportText) {
    try {
      const demoMd = demoReportEl.textContent || "";
      if (demoMd.trim()) {
        reportText.innerHTML = (typeof window.renderReport === 'function') ? window.renderReport(demoMd) : renderReport(demoMd);
        // Убеждаемся, что демо блок видим
        if (result && result.classList.contains("demo")) {
          result.style.display = "block";
        }
      }
    } catch (e) {
      console.warn("Demo render failed:", e);
    }
  } else {
    console.warn("Demo report elements not found:", { demoReportEl: !!demoReportEl, reportText: !!reportText });
  }

  // === base64 → Blob ===
  function base64ToBlob(base64, type = "application/octet-stream") {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  // === Запуск анализа ===
  analyzeBtn.addEventListener("click", async () => {
    const symbol = document.getElementById("symbol").value;
    const strategy = document.getElementById("strategy").value;
    const trading_type = tradingType.value;
    const capitalInput = document.getElementById("capital");
    const capital = parseFloat(capitalInput?.value || "10000");
    // ИСПРАВЛЕНО: Проверяем валидность капитала перед отправкой
    if (isNaN(capital) || capital <= 0) {
      showToast(`⚠️ ${t('error_invalid_capital_positive')}`, "error");
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = originalBtnText;
      return;
    }
    const risk = parseFloat(document.getElementById("risk").value);
    const confirmation = document.getElementById("confirmation").value;
    const timeframe = timeframeSelect && timeframeSelect.value !== "auto" ? timeframeSelect.value : null;

    if (!confirmation) {
      showToast("⚠️ " + t("select_confirmation"), "error");
      return;
    }

    startProgress();
    analyzeBtn.disabled = true;
    const originalBtnText = analyzeBtn.textContent;
    analyzeBtn.textContent = t("analyzing");
    const resultH2 = document.querySelector("#result h2");
    if (resultH2) {
      resultH2.textContent = t("report_title");
    }
    downloadBtn.disabled = true;
    downloadStatsBtn.disabled = true;

    try {
      await new Promise(r => setTimeout(r, 100));

      const minReliability = document.getElementById("minReliability")?.value || 50;
      const enableForecast = document.getElementById("enableForecast")?.checked || false;
      const enableBacktest = document.getElementById("enableBacktest")?.checked || false;
      const enableML = document.getElementById("enableML")?.checked || false;
      const backtestDays = document.getElementById("backtestDays")?.value === "auto" ? null : parseInt(document.getElementById("backtestDays")?.value || 60);
      const enableTrailing = document.getElementById("enableTrailing")?.checked || false;
      const trailingPercent = parseFloat(document.getElementById("trailingPercent")?.value || 50);
      // Уведомления закомментированы - не нужны при ручном запуске анализа
      // const enableEmail = document.getElementById("enableEmail")?.checked || false;
      // const alertMinReliability = parseFloat(document.getElementById("alertMinReliability")?.value || 60);

      // ✅ НОВОЕ: Сохраняем параметры анализа перед отправкой
      const analysisParams = {
          symbol, 
          strategy, 
          trading_type, 
          capital, 
          risk, 
          confirmation,
          timeframe: timeframe,  // Передаем выбранный таймфрейм (null если "auto")
          min_reliability: parseFloat(minReliability),
          enable_forecast: enableForecast,
          enable_backtest: enableBacktest,
          enable_ml: enableML,
          backtest_days: backtestDays,
          enable_trailing: enableTrailing,
          trailing_percent: trailingPercent,
        language: currentLanguage // ✅ Сохраняем язык
      };
      
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisParams)
      });

      const data = await res.json();
      stopProgress();

      // ✅ НОВОЕ: Сохраняем параметры и данные анализа при успешном результате
      if (!data.error) {
        lastAnalysisParams = analysisParams;
        lastAnalysisData = data;
        lastReportMeta = data.report_meta || null;
        // ✅ Сохраняем отчеты на всех языках для мгновенного переключения
        if (data.reports_by_language) {
          lastReportsByLanguage = data.reports_by_language;
          console.log('✅ Сохранены отчеты на всех языках:', Object.keys(data.reports_by_language));
        }
      }

      if (data.error) {
        if (data.limit_reached) {
          showToast("❌ " + t("free_limit_reached"), "error", 10000);
        } else {
        showToast("❌ " + data.error, "error");
        }
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = originalBtnText;
        // ИСПРАВЛЕНО: Включаем кнопки даже при ошибке (для повторной попытки)
        if (downloadBtn) {
          downloadBtn.disabled = false;
        }
        if (downloadStatsBtn && userPlan && userPlan !== 'free') {
          downloadStatsBtn.disabled = false;
        }
        // ✅ НОВОЕ: Активируем кнопку экспорта, если есть данные
        if (exportTradingViewBtn && window.lastAnalysisResult) {
          exportTradingViewBtn.disabled = false;
          exportTradingViewBtn.classList.remove('disabled-free');
        }
        return;
      }

      if (data.report_text) {
        // ✅ Сохраняем сырой markdown С КЛЮЧАМИ для перегенерации при смене языка
        // Используем report_markdown_raw если есть, иначе fallback на report_text
        lastReportMarkdown = data.report_markdown_raw || data.report_text;
        lastReportMeta = data.report_meta || lastReportMeta;
        reportText.innerHTML = renderReport(data.report_text, lastReportMeta);

        result.classList.remove("demo");
        showToast(t("analysis_complete"), "success");
        
        // Показываем сообщение об оставшихся анализах для Free
        if (data.remaining_analyses !== undefined && data.remaining_analyses !== null) {
          showToast(t("free_analyses_left", { count: data.remaining_analyses }), "info", 5000);
        }

        // === Real-Time график ===
        // ✅ ИСПРАВЛЕНО: Всегда загружаем график после анализа
        if (!realtimeChart) {
          const ctx = document.getElementById('realtimeChart');
          if (ctx) {
            initRealtimeChart();
          } else {
            console.warn('⚠️ Canvas элемент realtimeChart не найден');
          }
        }
        
        // ✅ ИСПРАВЛЕНО: Всегда подключаемся к символу из анализа
        if (realtimeChart) {
          // ✅ ИСПРАВЛЕНО: Используем currentSymbol если он есть, иначе символ из анализа
          const analysisSymbol = data.symbol || symbol.value || currentSymbol || 'BTC/USDT';
          const chartTimeframeSelectEl = document.getElementById('chartTimeframe');
          const analysisTimeframe = chartTimeframeSelectEl?.value || currentTimeframe || '1h';
          
          // ✅ ИСПРАВЛЕНО: Обновляем график только если символ действительно изменился
          if (currentSymbol !== analysisSymbol) {
            console.log('📊 Загрузка графика после анализа:', analysisSymbol, analysisTimeframe);
            connectWebSocket(analysisSymbol, analysisTimeframe);
          } else {
            console.log('📊 Символ не изменился, график уже показывает', analysisSymbol);
          }
        } else {
          console.warn('⚠️ График не инициализирован, пропускаем загрузку');
        }
        
        // Накладываем линии анализа, если они есть
        // ИСПРАВЛЕНО: Не меняем символ графика - используем текущий график независимо от символа анализа
        if (data.entry_price && data.stop_loss && data.take_profit) {
          // Удаляем старые линии анализа, если есть (оставляем цену + High/Low)
          if (realtimeChart && realtimeChart.data.datasets.length > 1) {
            const base = [realtimeChart.data.datasets[0]];
            if (realtimeChart.data.datasets[1] && realtimeChart.data.datasets[1].label === 'High') {
              base.push(realtimeChart.data.datasets[1]);
            }
            if (realtimeChart.data.datasets[2] && realtimeChart.data.datasets[2].label === 'Low') {
              base.push(realtimeChart.data.datasets[2]);
            }
            realtimeChart.data.datasets = base;
            updateRealtimeChartScale();
            realtimeChart.update('none');
          }
          
          // ✅ НОВОЕ: Сохраняем данные анализа для экспорта
          if (data.entry_price && data.symbol) {
            window.lastAnalysisResult = {
              symbol: data.symbol,
              entry_price: data.entry_price,
              stop_loss: data.stop_loss,
              take_profit: data.take_profit,
              direction: data.direction
            };
            
            // ✅ ВАЖНО: Активируем кнопку экспорта в TradingView
            if (exportTradingViewBtn) {
              exportTradingViewBtn.disabled = false;
              exportTradingViewBtn.classList.remove('disabled-free');
              console.log('✅ Кнопка экспорта в TradingView активирована');
            }
          }
          
          // Отображаем точки входа/выхода на текущем графике
          displaySignalLevels({
            symbol: data.symbol,
            entry_price: data.entry_price,
            stop_loss: data.stop_loss,
            take_profit: data.take_profit,
            direction: data.direction,
            enable_trailing: data.enable_trailing || false
          });
          
          // Запускаем таймер автоматического скрытия линий
          // Преобразуем значение типа торговли для маппинга
          const tradingTypeValue = tradingType.value;
          const mappedValue = tradingTypeMap[tradingTypeValue] || tradingTypeValue;
          scheduleLinesHide(mappedValue);
          
          showToast(t("lines_added"), 'success', 3000);
        }

        // === Визуализация кривой баланса бэктеста ===
        if (data.backtest && data.backtest.equity_curve && data.backtest.equity_curve.length > 0) {
          displayBacktestEquityCurve(data.backtest);
        } else {
          // Скрываем график, если нет данных
          const backtestChartContainer = document.getElementById('backtestChartContainer');
          if (backtestChartContainer) {
            backtestChartContainer.classList.add('hidden');
          }
        }

        // === Визуализация сравнительного бэктеста всех стратегий ===
        if (data.backtest_all_strategies && Object.keys(data.backtest_all_strategies).length > 0) {
          displayCompareBacktest(data.backtest_all_strategies);
        } else {
          hideCompareBacktest();
        }

        // ИСПРАВЛЕНО: Кнопка "Скачать ZIP" доступна всем после успешного анализа (только если есть данные)
        if (downloadBtn && data.zip_base64) {
        downloadBtn.disabled = false;
          // Удаляем класс disabled-free, если он есть (может быть установлен при инициализации)
          downloadBtn.classList.remove('disabled-free');
        } else if (downloadBtn) {
          // Если нет данных ZIP - оставляем кнопку отключенной
          downloadBtn.disabled = true;
        }
        
        // ✅ ВАЖНО: Активируем кнопку экспорта в TradingView, если есть данные
        if (exportTradingViewBtn && data.entry_price && data.symbol) {
          exportTradingViewBtn.disabled = false;
          exportTradingViewBtn.classList.remove('disabled-free');
          console.log('✅ Кнопка экспорта в TradingView активирована');
        } else if (exportTradingViewBtn) {
          exportTradingViewBtn.disabled = true;
        }
        
        // Кнопка "Скачать статистику" доступна только для Pro/Pro+ планов
        if (downloadStatsBtn) {
        // Восстанавливаем disabled только если не Free план
          if (userPlan && userPlan !== 'free') {
        downloadStatsBtn.disabled = false;
            // Удаляем класс disabled-free для Pro планов
            downloadStatsBtn.classList.remove('disabled-free');
          } else {
            // Для Free плана кнопка остается отключенной (уже установлено при загрузке)
            downloadStatsBtn.disabled = true;
            downloadStatsBtn.classList.add('disabled-free');
          }
        }
        
        // Восстанавливаем кнопку после успешного анализа
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = originalBtnText;

        // === Скачать ZIP отчёт ===
        if (downloadBtn && data.zip_base64) {
        downloadBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
              const res = await window.pyjs.saveZipFile(data.zip_base64 || "", "analysis_report.zip");
              if (res === "ok") {
                showToast(t('toast_zip_saved'), "success");
              } else {
                showToast(t('toast_save_cancelled'), "error");
              }
              return;
            }
            const blob = base64ToBlob(data.zip_base64, "application/zip");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "analysis_report.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(t('toast_zip_downloaded'), "success");
          } catch (err) {
            console.error("Ошибка скачивания:", err);
            showToast(t('toast_save_failed'), "error");
          }
        };
        } else if (downloadBtn) {
          // Если нет данных ZIP - отключаем обработчик
          downloadBtn.onclick = null;
          downloadBtn.disabled = true;
        }
      } else {
        showToast(t('toast_report_failed'), "error");
        // ИСПРАВЛЕНО: Включаем кнопки даже если нет отчета (для предыдущего анализа)
        if (downloadBtn) {
          downloadBtn.disabled = false;
          downloadBtn.classList.remove('disabled-free');
        }
        if (downloadStatsBtn && userPlan && userPlan !== 'free') {
          downloadStatsBtn.disabled = false;
          downloadStatsBtn.classList.remove('disabled-free');
        }
        // ✅ НОВОЕ: Активируем кнопку экспорта, если есть данные
        if (exportTradingViewBtn && window.lastAnalysisResult) {
          exportTradingViewBtn.disabled = false;
          exportTradingViewBtn.classList.remove('disabled-free');
        }
      }
    } catch (err) {
      stopProgress();
      console.error("Ошибка анализа:", err);
      showToast("❌ Ошибка анализа: " + err.message, "error");
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = originalBtnText;
      // ИСПРАВЛЕНО: Включаем кнопки даже при ошибке (для предыдущего анализа)
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.classList.remove('disabled-free');
      }
      if (downloadStatsBtn && userPlan && userPlan !== 'free') {
        downloadStatsBtn.disabled = false;
        downloadStatsBtn.classList.remove('disabled-free');
      }
      // ✅ НОВОЕ: Активируем кнопку экспорта, если есть данные
      if (exportTradingViewBtn && window.lastAnalysisResult) {
        exportTradingViewBtn.disabled = false;
        exportTradingViewBtn.classList.remove('disabled-free');
      }
    }
  });

  // === Скачать статистику ===
  downloadStatsBtn.addEventListener("click", async (e) => {
    // Проверяем, не отключена ли кнопка для Free плана
    if (downloadStatsBtn.disabled || downloadStatsBtn.classList.contains('disabled-free')) {
      return;
    }
    e.preventDefault();
    downloadStatsBtn.disabled = true;

    try {
      const res = await fetch("/download_user_stats_bundle", { credentials: 'include' });
      if (!res.ok) {
        showToast(t('toast_stats_no_data'), "error");
        downloadStatsBtn.disabled = false;
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      // Если доступен мост PyQt — сохраняем через системный диалог (ZIP)
      if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result || "").toString().split(",")[1] || "";
            const res2 = await window.pyjs.saveZipFile(base64, "user_stats_bundle.zip");
            if (res2 === "ok") {
              showToast(t('toast_archive_saved'), "success");
            } else {
              showToast(t('toast_save_cancelled'), "error");
            }
          } catch (err) {
            console.error("Ошибка сохранения через мост:", err);
            a.href = url;
            a.download = "user_stats_bundle.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(t('toast_stats_downloaded'), "success");
          }
        };
        reader.onerror = () => {
          a.href = url;
          a.download = "user_stats_bundle.zip";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(t('toast_stats_downloaded'), "success");
        };
        reader.readAsDataURL(blob);
      } else {
        a.href = url;
        a.download = "user_stats_bundle.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('toast_stats_downloaded'), "success");
      }
    } catch (err) {
      console.error("Ошибка при скачивании статистики:", err);
      showToast(t('toast_save_failed'), "error");
    } finally {
      downloadStatsBtn.disabled = false;
    }
  });

  // === Экспорт в TradingView ===
  if (exportTradingViewBtn) {
    exportTradingViewBtn.addEventListener("click", async (e) => {
      if (exportTradingViewBtn.disabled) return;
      
      e.preventDefault();
      exportTradingViewBtn.disabled = true;
      
      try {
        // Получаем данные из currentAnalysis или из последнего анализа
        let exportData = null;
        
        if (currentAnalysis && currentAnalysis.entry_price) {
          // Используем данные из currentAnalysis (график)
          exportData = {
            symbol: currentSymbol || document.getElementById('symbol')?.value || 'BTC/USDT',
            entry_price: currentAnalysis.entry_price,
            stop_loss: currentAnalysis.stop_loss,
            take_profit: currentAnalysis.take_profit,
            direction: currentAnalysis.direction
          };
        } else if (window.lastAnalysisResult) {
          // Пробуем получить из последнего ответа анализа
          exportData = {
            symbol: window.lastAnalysisResult.symbol,
            entry_price: window.lastAnalysisResult.entry_price,
            stop_loss: window.lastAnalysisResult.stop_loss,
            take_profit: window.lastAnalysisResult.take_profit,
            direction: window.lastAnalysisResult.direction
          };
        } else {
          showToast('❌ ' + (t('error_export_tradingview') || 'Ошибка экспорта') + ': ' + (t('error_no_data') || 'Нет данных для экспорта'), 'error');
          exportTradingViewBtn.disabled = false;
          return;
        }
        
        if (!exportData || !exportData.entry_price) {
          showToast('❌ ' + (t('error_export_tradingview') || 'Ошибка экспорта') + ': ' + (t('error_no_data') || 'Нет данных для экспорта'), 'error');
          exportTradingViewBtn.disabled = false;
          return;
        }
        
        // Отправляем запрос на экспорт
        const response = await fetch('/api/export_tradingview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(exportData)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Export failed');
        }
        
        // ✅ ИСПРАВЛЕНО: Получаем текст JSON (не blob)
        const jsonText = await response.text();
        
        // Формируем имя файла
        const symbolForFile = exportData.symbol.replace('/', '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `tradingview_${symbolForFile}_${dateStr}.json`;
        
        // ✅ Если доступен мост PyQt — сохраняем через системный диалог
        if (window.pyjs && typeof window.pyjs.saveJsonFile === "function") {
          const res = await window.pyjs.saveJsonFile(jsonText, fileName);
          if (res === "ok") {
            showToast('✅ ' + (t('export_tradingview') || 'Экспорт в TradingView') + ' успешно', 'success');
          } else {
            showToast(t('toast_save_cancelled'), 'error');
          }
        } else {
          // Браузерный способ - скачивание в папку загрузок
          const blob = new Blob([jsonText], { type: 'application/json; charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('✅ ' + (t('export_tradingview') || 'Экспорт в TradingView') + ' успешно', 'success');
        }
      } catch (error) {
        console.error('Ошибка экспорта в TradingView:', error);
        showToast('❌ ' + (t('error_export_tradingview') || 'Ошибка экспорта') + ': ' + error.message, 'error');
      } finally {
        exportTradingViewBtn.disabled = false;
      }
    });
  }

  // === Загрузка анализа стратегий ===
  if (loadStrategyAnalysisBtn && strategyAnalysisDiv) {
    loadStrategyAnalysisBtn.addEventListener("click", async () => {
      // Проверяем, не отключена ли кнопка для Free плана
      if (loadStrategyAnalysisBtn.disabled || loadStrategyAnalysisBtn.classList.contains('disabled-free')) {
        return;
      }
      loadStrategyAnalysisBtn.disabled = true;
      loadStrategyAnalysisBtn.textContent = t('loading');
      
      try {
        // ✅ НОВОЕ: Передаем язык в запрос
        const res = await fetch(`/api/strategy_analysis?language=${currentLanguage}`);
        const data = await res.json();
        
        if (data.error && data.error !== "Нет данных") {
          showToast("❌ " + data.error, "error");
          return;
        }
        
        // Показываем секцию анализа
        strategyAnalysisDiv.classList.remove("hidden");
        
        // Auto Summary
        const autoSummaryText = document.getElementById("autoSummaryText");
        if (autoSummaryText) {
          if (data.auto_summary) {
            const formattedSummary = formatAutoSummaryHtml(data.auto_summary) || formatInlineStrong(data.auto_summary).replace(/\n/g, '<br>');
            autoSummaryText.innerHTML = formattedSummary;
          } else {
            autoSummaryText.innerHTML = t('insufficient_data');
          }
        }
        
        // Таблица стратегий
        const strategyStatsTable = document.getElementById("strategyStatsTable");
        const strategySummaryLine = document.getElementById("strategySummaryLine");
        if (strategyStatsTable && data.strategy_stats) {
          const stats = data.strategy_stats;
          if (Object.keys(stats).length === 0) {
            strategyStatsTable.innerHTML = `<p>${t('no_strategy_data')}</p>`;
            if (strategySummaryLine) {
              strategySummaryLine.textContent = '';
            }
          } else {
            if (strategySummaryLine) {
              const entries = Object.entries(stats);
              let totalTrades = 0;
              let successfulTrades = 0;
              let failedTrades = 0;
              let bestStrategy = null;
              let bestAvg = -Infinity;

              entries.forEach(([name, s]) => {
                const tt = Number(s.total_trades || 0);
                const succ = Number(s.successful_trades || 0);
                const fail = Number(s.failed_trades || 0);
                const avg = Number(s.avg_profit_percent || 0);
                totalTrades += tt;
                successfulTrades += succ;
                failedTrades += fail;
                if (avg > bestAvg) {
                  bestAvg = avg;
                  bestStrategy = name;
                }
              });

              const strategyTranslations = {
                'Консервативная': t('conservative'),
                'Сбалансированная': t('balanced'),
                'Агрессивная': t('aggressive'),
                'Conservative': t('conservative'),
                'Balanced': t('balanced'),
                'Aggressive': t('aggressive'),
                'Консервативна': t('conservative'),
                'Збалансована': t('balanced'),
                'Агресивна': t('aggressive')
              };
              const bestName = strategyTranslations[bestStrategy] || bestStrategy || '';
              const summary = t('strategy_summary_line', {
                total: totalTrades,
                successful: successfulTrades,
                failed: failedTrades,
                best: bestName
              });
              strategySummaryLine.textContent = String(summary || '');
            }

            // ✅ ИСПРАВЛЕНО: Используем переводы для заголовков таблицы
            let tableHtml = '<table class="report-table"><thead><tr>';
            tableHtml += `<th>${t('strategy_table_strategy')}</th>`;
            tableHtml += `<th>${t('strategy_table_trades')}</th>`;
            tableHtml += `<th>${t('strategy_table_successful')}</th>`;
            tableHtml += `<th>${t('strategy_table_win_rate')}</th>`;
            tableHtml += `<th>${t('strategy_table_avg_profit')}</th>`;
            tableHtml += `<th>${t('strategy_table_total_profit')}</th>`;
            tableHtml += `<th>${t('strategy_table_max_profit')}</th>`;
            tableHtml += `<th>${t('strategy_table_max_loss')}</th>`;
            tableHtml += '</tr></thead><tbody>';
            
            // Сортируем по средней прибыли
            const sortedStrategies = Object.entries(stats).sort((a, b) => 
              b[1].avg_profit_percent - a[1].avg_profit_percent
            );
            
            // ✅ ИСПРАВЛЕНО: Переводим названия стратегий
            const strategyTranslations = {
              'Консервативная': t('conservative'),
              'Сбалансированная': t('balanced'),
              'Агрессивная': t('aggressive'),
              'Conservative': t('conservative'),
              'Balanced': t('balanced'),
              'Aggressive': t('aggressive'),
              'Консервативна': t('conservative'),
              'Збалансована': t('balanced'),
              'Агресивна': t('aggressive')
            };
            
            for (const [strategy, stat] of sortedStrategies) {
              const profitColor = stat.avg_profit_percent >= 0 ? "#34D399" : "#EF4444";
              // Переводим название стратегии
              const translatedStrategy = strategyTranslations[strategy] || strategy;
              tableHtml += '<tr>';
              tableHtml += `<td><strong>${escapeHtml(translatedStrategy)}</strong></td>`;
              tableHtml += `<td>${stat.total_trades}</td>`;
              tableHtml += `<td>${stat.successful_trades}</td>`;
              tableHtml += `<td>${stat.win_rate.toFixed(1)}%</td>`;
              tableHtml += `<td style="color: ${profitColor}">${stat.avg_profit_percent.toFixed(2)}%</td>`;
              tableHtml += `<td style="color: ${profitColor}">${stat.total_profit_percent.toFixed(2)}%</td>`;
              tableHtml += `<td style="color: #34D399">${stat.max_profit !== null ? stat.max_profit.toFixed(2) + '%' : 'N/A'}</td>`;
              tableHtml += `<td style="color: #EF4444">${stat.max_loss !== null ? stat.max_loss.toFixed(2) + '%' : 'N/A'}</td>`;
              tableHtml += '</tr>';
            }
            
            tableHtml += '</tbody></table>';
            strategyStatsTable.innerHTML = tableHtml;
          }
        }
        
        // Benchmark сравнение
        const benchmarkContent = document.getElementById("benchmarkContent");
        const benchmarkComparison = document.getElementById("benchmarkComparison");
        if (benchmarkContent && data.benchmark) {
          const bench = data.benchmark;
          const strategyReturn = Number(bench.strategy_return || 0);
          const buyHoldReturn = Number(bench.buy_hold_return || 0);
          const difference = Number(bench.difference || 0);

          const values = [strategyReturn, buyHoldReturn, difference];
          const maxAbs = Math.max(...values.map(v => Math.abs(v)), 0.0001);

          const formatPct = (v) => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
          const widthPct = (v) => {
            const abs = Math.abs(Number(v) || 0);
            if (abs <= 0) return 0;
            const w = (abs / maxAbs) * 100;
            return Math.max(2, Math.min(100, w));
          };

          const rows = [
            { label: t('strategy_return_label'), value: strategyReturn },
            { label: t('buy_hold_return_label'), value: buyHoldReturn },
            { label: t('difference_label'), value: difference }
          ];

          let benchmarkHtml = '<div class="benchmark-bars">';
          rows.forEach(r => {
            const positive = r.value >= 0;
            const fillClass = positive ? 'pos' : 'neg';
            benchmarkHtml += '<div class="benchmark-bar-row">';
            benchmarkHtml += `<div class="benchmark-bar-label">${escapeHtml(String(r.label || ''))}</div>`;
            benchmarkHtml += '<div class="benchmark-bar-track">';
            benchmarkHtml += `<div class="benchmark-bar-fill ${fillClass}" style="width:${widthPct(r.value)}%"></div>`;
            benchmarkHtml += '</div>';
            benchmarkHtml += `<div class="benchmark-bar-value ${fillClass}">${formatPct(r.value)}</div>`;
            benchmarkHtml += '</div>';
          });
          benchmarkHtml += '</div>';

          const captionKey = difference > 0 ? 'strategy_better' : difference < 0 ? 'btc_better' : 'equal';
          benchmarkHtml += `<div class="benchmark-caption">${escapeHtml(String(t(captionKey) || ''))}</div>`;

          if (bench.total_trades !== undefined && bench.total_trades !== null) {
            benchmarkHtml += `<p class="benchmark-note">${t('comparison_based_on', {count: bench.total_trades})}</p>`;
          }
          
          benchmarkContent.innerHTML = benchmarkHtml;
          benchmarkComparison.classList.remove("hidden");
        } else if (benchmarkComparison) {
          benchmarkComparison.classList.add("hidden");
        }

        // Additional recommendations
        const additionalRecommendations = document.getElementById("additionalRecommendations");
        const additionalRecommendationsContent = document.getElementById("additionalRecommendationsContent");
        if (additionalRecommendations && additionalRecommendationsContent && Array.isArray(data.additional_recommendations) && data.additional_recommendations.length) {
          const items = data.additional_recommendations
            .map(s => String(s || '').trim())
            .filter(Boolean);
          if (items.length) {
            const listHtml = '<ul class="recommendations-list">' +
              items.map(it => `<li>${escapeHtml(it)}</li>`).join('') +
              '</ul>';
            additionalRecommendationsContent.innerHTML = listHtml;
            additionalRecommendations.classList.remove('hidden');
          } else {
            additionalRecommendations.classList.add('hidden');
          }
        } else if (additionalRecommendations) {
          additionalRecommendations.classList.add('hidden');
        }
        
        // Heatmap
        const heatmapSection = document.getElementById("heatmapSection");
        const heatmapImageContainer = document.getElementById("heatmapImageContainer");
        if (heatmapSection && data.heatmap && data.heatmap_image) {
          heatmapImageContainer.innerHTML = `<img src="data:image/png;base64,${data.heatmap_image}" alt="Heatmap" style="max-width: 100%; height: auto; border-radius: 8px;">`;
          heatmapSection.classList.remove("hidden");
        } else if (heatmapSection) {
          heatmapSection.classList.add("hidden");
        }
        
        showToast(`✅ ${t('analysis_loaded', {count: data.total_reports || 0})}`, "success");
      } catch (err) {
        console.error("Ошибка загрузки анализа:", err);
        showToast(`❌ ${t('error_loading_analysis')}`, "error");
      } finally {
        loadStrategyAnalysisBtn.disabled = false;
        loadStrategyAnalysisBtn.textContent = t('strategy_analysis');
      }
    });
  }

  // ✅ ИСПРАВЛЕНО: Функции initRealtimeChart, formatTime и connectWebSocket уже объявлены выше, перед DOMContentLoaded
  // Удаляем дубликаты - они уже определены выше

  // Обновление графика (упрощенная версия, так как данные уже в массивах)
  function updateRealtimeChart(price, timeStr) {
    // Эта функция больше не нужна для добавления точек,
    // так как мы обновляем массивы напрямую в onmessage
    // Оставляем только для совместимости, если где-то вызывается
    if (!realtimeChart) {
      console.warn('График не инициализирован при попытке обновления');
      return;
    }
    
    if (isNaN(price) || price <= 0) {
      console.warn('Невалидная цена для графика:', price);
      return;
    }
    
    // Обновляем график из массивов
    if (realtimeChart) {
      realtimeChart.data.labels = [...timeHistory];
      realtimeChart.data.datasets[0].data = [...priceHistory];
      
      // Обновляем линии входа/выхода, если они есть
      if (currentAnalysis && realtimeChart.data.datasets.length > 1) {
        for (let i = 1; i < realtimeChart.data.datasets.length; i++) {
          const dataset = realtimeChart.data.datasets[i];
          if (dataset.label === 'Entry' || dataset.label === 'Stop Loss' || dataset.label === 'Take Profit') {
            const lineValue = dataset.data && dataset.data.length > 0 
              ? (dataset.data[0] || dataset.data[dataset.data.length - 1])
              : null;
            if (lineValue !== null) {
              dataset.data = priceHistory.map(() => lineValue);
            }
          }
        }
      }
      
      realtimeChart.update('none');
    }
  }

  // Обновление информации о цене

  // Отображение точек входа/выхода
  function displaySignalLevels(analysis) {
    if (!analysis || !realtimeChart) return;

    const chartSymbol = normalizeSymbol(currentSymbol || document.getElementById('symbol')?.value);
    const analysisSymbol = normalizeSymbol(analysis.symbol || '');
    if (analysisSymbol && chartSymbol && analysisSymbol !== chartSymbol) {
      return;
    }

    const entry = Number(analysis.entry_price);
    const slRaw = Number(analysis.stop_loss);
    const tpRaw = Number(analysis.take_profit);
    if (![entry, slRaw, tpRaw].every(v => Number.isFinite(v) && v > 0)) {
      return;
    }

    const normalizeDirection = (s) => {
      const v = String(s || '').trim().toLowerCase();
      if (!v) return null;
      if (v.includes('short') || v.includes('sell') || v.includes('шорт') || v.includes('прод')) return 'short';
      if (v.includes('long') || v.includes('buy') || v.includes('лонг') || v.includes('покуп')) return 'long';
      return null;
    };
    const direction = (tpRaw > entry && slRaw < entry)
      ? 'long'
      : (tpRaw < entry && slRaw > entry)
        ? 'short'
        : (normalizeDirection(analysis.direction) || 'long');

    const slDist = Math.abs(slRaw - entry);
    const tpDist = Math.abs(tpRaw - entry);
    const sl = direction === 'short' ? (entry + slDist) : (entry - slDist);
    const tp = direction === 'short' ? (entry - tpDist) : (entry + tpDist);

    const normalizedAnalysis = {
      ...analysis,
      direction,
      stop_loss: sl,
      take_profit: tp,
      entry_price: entry
    };

    currentAnalysis = normalizedAnalysis;

    const baseDatasets = [realtimeChart.data.datasets[0]];
    realtimeChart.data.datasets = baseDatasets;
    
    // Создаем данные для линий (используем текущие labels или создаем один элемент)
    const labelsCount = realtimeChart.data.labels.length || 1;
    const lineData = Array(labelsCount).fill(null);
    
    // Добавляем линии на график как отдельные datasets
    const entryLine = {
      label: t('chart_entry') || 'Entry',
      data: lineData.map(() => entry),
      borderColor: 'rgb(63, 169, 245)', // Яркий синий/голубой (цвет темы)
      backgroundColor: 'rgba(63, 169, 245, 0.8)', // Синий для легенды
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(63, 169, 245)',
      pointBorderColor: 'rgb(63, 169, 245)',
      fill: false,
      spanGaps: true
    };
    
    const stopLossLine = {
      label: normalizedAnalysis.enable_trailing ? (t('chart_trailing_stop') || 'Trailing Stop Loss') : (t('chart_stop_loss') || 'Stop Loss'),
      data: lineData.map(() => sl),
      borderColor: normalizedAnalysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      backgroundColor: normalizedAnalysis.enable_trailing ? 'rgba(255, 152, 0, 0.8)' : 'rgba(239, 68, 68, 0.8)',
      borderWidth: normalizedAnalysis.enable_trailing ? 3 : 2,
      borderDash: normalizedAnalysis.enable_trailing ? [10, 4] : [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: normalizedAnalysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      pointBorderColor: normalizedAnalysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      fill: false,
      spanGaps: true
    };
    
    const takeProfitLine = {
      label: t('chart_take_profit') || 'Take Profit',
      data: lineData.map(() => tp),
      borderColor: 'rgb(34, 211, 153)', // Яркий зеленый (более контрастный)
      backgroundColor: 'rgba(34, 211, 153, 0.8)', // Зеленый для легенды
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(34, 211, 153)',
      pointBorderColor: 'rgb(34, 211, 153)',
      fill: false,
      spanGaps: true
    };
    
    // Добавляем новые линии
    realtimeChart.data.datasets.push(entryLine, stopLossLine, takeProfitLine);
    
    // Инициализируем трейлинг-стоп, если включен
    if (normalizedAnalysis.enable_trailing && normalizedAnalysis.trailing_percent) {
      initTrailingStop(normalizedAnalysis, normalizedAnalysis.trailing_percent);
    } else {
      trailingStopState.enabled = false;
    }
    
    updateRealtimeChartScale();
    realtimeChart.update();
  }

  // ✅ ИСПРАВЛЕНО: trailingStopState уже объявлена выше, перед DOMContentLoaded

  // Функция обновления трейлинг-стопа в реальном времени
  function updateTrailingStop(price) {
    if (!trailingStopState.enabled || !trailingStopState.entry || !realtimeChart) {
      return;
    }

    const { entry, baseSl, trailingPercent, direction, bestPrice } = trailingStopState;
    trailingStopState.currentPrice = price;

    let newSl = baseSl;
    let slUpdated = false;

    if (direction === 'long') {
      // Для лонга: обновляем лучшую цену и двигаем SL вверх
      if (price > entry) {
        const newBestPrice = bestPrice ? Math.max(bestPrice, price) : price;
        trailingStopState.bestPrice = newBestPrice;
        
        // Прибыль от входа
        const profitPotential = newBestPrice - entry;
        // Трейлинг-стоп на trailing_percent от прибыли
        const trailingSl = entry + (profitPotential * trailingPercent);
        // SL не может быть ниже базового
        newSl = Math.max(baseSl, trailingSl);
        
        if (Math.abs(newSl - (trailingStopState.currentSl || baseSl)) > 0.001) {
          slUpdated = true;
          trailingStopState.currentSl = newSl;
        }
      }
    } else if (direction === 'short') {
      // Для шорта: обновляем лучшую цену и двигаем SL вниз
      if (price < entry) {
        const newBestPrice = bestPrice ? Math.min(bestPrice, price) : price;
        trailingStopState.bestPrice = newBestPrice;
        
        // Прибыль от входа
        const profitPotential = entry - newBestPrice;
        // Трейлинг-стоп на trailing_percent от прибыли
        const trailingSl = entry - (profitPotential * trailingPercent);
        // SL не может быть выше базового
        newSl = Math.min(baseSl, trailingSl);
        
        if (Math.abs(newSl - (trailingStopState.currentSl || baseSl)) > 0.001) {
          slUpdated = true;
          trailingStopState.currentSl = newSl;
        }
      }
    }

    // Обновляем линию стоп-лосса на графике
    if (slUpdated && realtimeChart.data.datasets.length > 2) {
      const slDataset = realtimeChart.data.datasets.find(d => 
        d.label === 'Stop Loss' || d.label === 'Trailing Stop Loss'
      );
      if (slDataset) {
        const labelsCount = realtimeChart.data.labels.length || 1;
        slDataset.data = Array(labelsCount).fill(newSl);
        slDataset.label = 'Trailing Stop Loss';
        slDataset.borderColor = '#ff9800'; // Оранжевый цвет
        slDataset.borderWidth = 2;
        slDataset.borderDash = [10, 5]; // Пунктир
        realtimeChart.update('none');
        
        console.log(`📈 Trailing SL updated: ${newSl.toFixed(2)} (price: ${price.toFixed(2)})`);
      }
    }
  }

  // Инициализация трейлинг-стопа при отображении уровней
  function initTrailingStop(analysis, trailingPercent) {
    if (!analysis || !analysis.enable_trailing) {
      trailingStopState.enabled = false;
      return;
    }

    trailingStopState.enabled = true;
    trailingStopState.entry = analysis.entry_price;
    trailingStopState.baseSl = analysis.stop_loss;
    trailingStopState.currentSl = analysis.stop_loss;
    trailingStopState.trailingPercent = (trailingPercent || 50) / 100; // Преобразуем из процентов
    trailingStopState.direction = analysis.direction;
    trailingStopState.bestPrice = null;
    
    console.log('🔄 Trailing stop initialized:', trailingStopState);
  }

  // Функция автоматического скрытия линий анализа
  function scheduleLinesHide(tradingType) {
    // Очищаем предыдущий таймер, если есть
    if (linesHideTimer) {
      clearTimeout(linesHideTimer);
      linesHideTimer = null;
    }
    
    // Получаем длительность показа линий для типа торговли
    const duration = linesDisplayDuration[tradingType] || 15 * 60 * 1000; // По умолчанию 15 минут
    
    // Устанавливаем таймер на скрытие линий
    linesHideTimer = setTimeout(() => {
      if (realtimeChart && realtimeChart.data.datasets.length > 1) {
        // Удаляем все линии кроме графика цены (первый dataset)
        realtimeChart.data.datasets = [realtimeChart.data.datasets[0]];
        realtimeChart.update();
        currentAnalysis = null;
        showToast('⏰ Линии анализа скрыты (время истекло)', 'info', 3000);
      }
      linesHideTimer = null;
    }, duration);
  }

  // ✅ ИСПРАВЛЕНО: checkSignalLevels и highlightSignalLine перемещены в глобальную область (перед DOMContentLoaded)

  // ✅ ИСПРАВЛЕНО: stopWebSocket перемещена в глобальную область (перед DOMContentLoaded)

  // Кнопка остановки real-time
  const stopRealtimeBtn = document.getElementById('stopRealtimeBtn');
  if (stopRealtimeBtn) {
    stopRealtimeBtn.addEventListener('click', () => {
      stopWebSocket();
    });
  }

  // === Инициализация графика при загрузке страницы ===
  // Небольшая задержка для гарантии, что DOM полностью загружен
  setTimeout(() => {
    // Инициализируем график, если еще не инициализирован
    if (!realtimeChart) {
      const ctx = document.getElementById('realtimeChart');
      if (ctx) {
        initRealtimeChart();
      }
    }

    // Показываем контейнер графика (убираем hidden, если есть)
    const realtimeContainer = document.getElementById('realtimeChartContainer');
    if (realtimeContainer) {
      realtimeContainer.classList.remove('hidden');
      realtimeContainer.style.display = 'block';
    }

    // ✅ ИСПРАВЛЕНО: Подключаемся к WebSocket для выбранной пары по умолчанию
    const symbolSelect = document.getElementById('symbol');
    const chartTimeframeSelect = document.getElementById('chartTimeframe');
    const beginnerSymbolSelect = document.getElementById('beginnerSymbol');
    
    // ✅ ИСПРАВЛЕНО: Проверяем наличие элементов и графика
    if (symbolSelect && realtimeChart) {
      const initialSymbol = getActiveSymbolForChart();
      const initialChartTimeframe = chartTimeframeSelect?.value || '1h';
      
      // ✅ ИСПРАВЛЕНО: Подключаемся только если нет активного подключения или график пустой
      if (!wsConnection || wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
        // Всегда подключаемся при первой загрузке (график должен быть заполнен)
        console.log('📊 Подключение к WebSocket:', initialSymbol, initialChartTimeframe);
        connectWebSocket(initialSymbol, initialChartTimeframe);
      } else if (priceHistory.length === 0) {
        // Если подключение есть, но график пустой - переподключаемся
        console.log('📊 График пустой, переподключение...');
        wsManuallyStopped = false;
        connectWebSocket(initialSymbol, initialChartTimeframe);
      } else {
        console.log('📊 График уже подключен и имеет данные');
      }
      
      // ✅ Обработчик изменения выбранной пары (для графика и формы анализа)
      symbolSelect.addEventListener('change', () => {
        const newSymbol = symbolSelect.value;
        const chartTf = chartTimeframeSelect?.value || '1h';

        syncSymbolSelects(newSymbol);
        
        // ✅ ИСПРАВЛЕНО: Обновляем график только если символ действительно изменился
        if (currentSymbol === newSymbol) {
          return; // Символ не изменился, ничего не делаем
        }
        
        console.log('🔄 Смена символа с', currentSymbol, 'на', newSymbol);
        
        // Очищаем график при смене пары
        priceHistory = [];
        timeHistory = [];
        lastPrice = null;
        currentAnalysis = null;
        
        if (realtimeChart) {
          realtimeChart.data.labels = [];
          realtimeChart.data.datasets[0].data = [];
          // Удаляем линии анализа при смене пары
          if (realtimeChart.data.datasets.length > 1) {
            realtimeChart.data.datasets = [realtimeChart.data.datasets[0]];
          }
          updateRealtimeChartScale();
          realtimeChart.update('none');
        }
        
        // ✅ ИСПРАВЛЕНО: Останавливаем старый fallback перед переподключением
        if (window.stopPriceUpdateFallback) {
          window.stopPriceUpdateFallback();
        }
        
        // Переподключаемся к новой паре
        if (wsConnection) {
          wsManuallyStopped = true; // Временно останавливаем, чтобы не переподключаться автоматически
          wsConnection.close();
          wsConnection = null;
        }
        
        // ВАЖНО: Сбрасываем флаг ПЕРЕД новым подключением
        wsManuallyStopped = false;
        
        // Небольшая задержка перед переподключением
        setTimeout(() => {
          connectWebSocket(newSymbol, chartTf);
        }, 500);
      });

      // ✅ NEW: если пользователь меняет пару в режиме новичка, синхронизируем и график тоже
      if (beginnerSymbolSelect) {
        beginnerSymbolSelect.addEventListener('change', () => {
          const newSymbol = beginnerSymbolSelect.value || 'BTC/USDT';
          const chartTf = chartTimeframeSelect?.value || '1h';
          syncSymbolSelects(newSymbol);
          if (currentSymbol !== newSymbol) {
            setTimeout(() => {
              connectWebSocket(newSymbol, chartTf);
            }, 150);
          }
        });
      }
      
      // Обработчик изменения таймфрейма графика
      chartTimeframeSelect.addEventListener('change', () => {
        const newChartTf = chartTimeframeSelect.value;
        const currentSym = symbolSelect.value;
        
        // Очищаем график при смене таймфрейма
        priceHistory = [];
        timeHistory = [];
        lastPrice = null;
        // НЕ очищаем currentAnalysis - линии анализа сохраняются
        
        if (realtimeChart) {
          realtimeChart.data.labels = [];
          realtimeChart.data.datasets[0].data = [];
          // Сохраняем линии анализа при смене таймфрейма (они будут обновлены при следующем обновлении)
          realtimeChart.update('none');
        }
        
        // Переподключаемся с новым таймфреймом
        if (wsConnection) {
          wsManuallyStopped = true;
          wsConnection.close();
          wsConnection = null;
        }
        setTimeout(() => {
          connectWebSocket(currentSym, newChartTf);
        }, 500);
      });
    }
  }, 100);

  // === Режим новичка ===
  const modeToggleBtn = document.getElementById('modeToggleBtn');
  const beginnerForm = document.getElementById('beginnerForm');
  const advancedForm = document.getElementById('advancedForm');
  const beginnerResult = document.getElementById('beginnerResult');
  window.isBeginnerMode = false; // Объявляем глобально для updateTranslations
  
  if (modeToggleBtn) {
    modeToggleBtn.addEventListener('click', () => {
      window.isBeginnerMode = !window.isBeginnerMode;
      
      if (window.isBeginnerMode) {
        // Режим новичка
        modeToggleBtn.textContent = t('beginner_mode_advanced');
        if (beginnerForm) beginnerForm.style.display = 'grid';
        if (advancedForm) advancedForm.style.display = 'none';
        if (result) result.style.display = 'none';
        if (beginnerResult) beginnerResult.style.display = 'none';
      } else {
        // Расширенный режим
        modeToggleBtn.textContent = t('beginner_mode');
        if (beginnerForm) beginnerForm.style.display = 'none';
        if (advancedForm) advancedForm.style.display = 'grid';
        if (beginnerResult) beginnerResult.style.display = 'none';
        if (result) result.style.display = 'block';
      }

      const newSymbol = getActiveSymbolForChart();
      const chartTf = document.getElementById('chartTimeframe')?.value || '1h';
      syncSymbolSelects(newSymbol);
      if (typeof connectWebSocket === 'function') {
        connectWebSocket(newSymbol, chartTf);
      }
    });
  }

  // Упрощенный анализ для новичка
  const beginnerAnalyzeBtn = document.getElementById('beginnerAnalyzeBtn');
  const progressBarBeginner = document.getElementById('progressBarBeginner');
  
  if (beginnerAnalyzeBtn) {
    beginnerAnalyzeBtn.addEventListener('click', async () => {
      const beginnerCapitalInput = document.getElementById('beginnerCapital');
      const capital = parseFloat(beginnerCapitalInput?.value || "10000");
      // ИСПРАВЛЕНО: Проверяем валидность капитала для режима новичка
      if (isNaN(capital) || capital <= 0) {
        showToast(`⚠️ ${t('error_invalid_capital_positive')}`, "error");
        beginnerAnalyzeBtn.disabled = false;
        beginnerAnalyzeBtn.textContent = t('beginner_analyze');
        if (progressBarBeginner) progressBarBeginner.classList.add('hidden');
        return;
      }
      const symbol = document.getElementById('beginnerSymbol')?.value || 'BTC/USDT';
      
      beginnerAnalyzeBtn.disabled = true;
      beginnerAnalyzeBtn.textContent = t('analyzing');
      if (progressBarBeginner) progressBarBeginner.classList.remove('hidden');
      if (beginnerResult) beginnerResult.style.display = 'none';
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            symbol: symbol,
            capital: capital,
            trading_type: 'daytrading',
            strategy: 'balanced',
            risk: 1,
            confirmation: 'EMA+RSI',
            timeframe: 'auto',
            min_reliability: 50,
            enable_forecast: false,
            enable_backtest: false,
            enable_ml: false,
            enable_trailing: false,
            language: currentLanguage
          })
        });

        clearTimeout(timeoutId);
        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          data = null;
        }

        if (!res.ok) {
          const msg = (data && data.error) ? String(data.error) : t('error_analysis_failed');
          showToast(`❌ ${msg}`, 'error', 8000);
          return;
        }

        if (data && data.report_text) {
          displayBeginnerResult(data, symbol, capital);
          return;
        }

        showToast(`⚠️ ${t('error_analysis_failed')}`, 'error', 8000);
      } catch (err) {
        console.error('Ошибка:', err);
        if (err && err.name === 'AbortError') {
          showToast(`⚠️ ${t('error_server_connection')}`, 'error', 8000);
        } else {
          showToast(`⚠️ ${t('error_server_connection')}`, 'error', 8000);
        }
      } finally {
        beginnerAnalyzeBtn.disabled = false;
        beginnerAnalyzeBtn.textContent = t('beginner_analyze');
        if (progressBarBeginner) progressBarBeginner.classList.add('hidden');
      }
    });
  }

  // Функция отображения упрощенного результата для новичка
  function displayBeginnerResult(data, symbol, capital) {
    const entryPrice = data.entry_price;
    const stopLoss = data.stop_loss;
    const takeProfit = data.take_profit;
    const direction = data.direction;
    const reliability = data.reliability_rating || 0;
    
    let action = '⏸ ' + t('beginner_when_to_buy');
    let actionColor = '#f59e0b';
    let entryLabel = t('beginner_entry_price');
    let entryValue = '-';
    let targetLabel = t('beginner_target_price');
    let targetValue = '-';
    let stopLabel = t('beginner_stop_loss');
    let stopValue = '-';
    let riskLevel = t('beginner_risk_medium');
    let riskColor = '#f59e0b';
    
    if (entryPrice && stopLoss && takeProfit) {
      if (direction === 'long') {
        action = '✅ ' + t('beginner_when_to_buy') + ' (' + t('beginner_long') + ')';
        actionColor = '#34d399';
        entryValue = `$${entryPrice.toFixed(2)}`;
        targetValue = `$${takeProfit.toFixed(2)}`;
        stopValue = `$${stopLoss.toFixed(2)}`;
      } else if (direction === 'short') {
        action = '📉 ' + t('beginner_when_to_sell') + ' (' + t('beginner_short') + ')';
        actionColor = '#ef4444';
        entryValue = `$${entryPrice.toFixed(2)}`;
        targetValue = `$${takeProfit.toFixed(2)}`;
        stopValue = `$${stopLoss.toFixed(2)}`;
      }
      
      const riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice * 100);
      if (riskPercent < 2) {
        riskLevel = t('beginner_risk_low');
        riskColor = '#34d399';
      } else if (riskPercent > 5) {
        riskLevel = t('beginner_risk_high');
        riskColor = '#ef4444';
      }
    }
    
    if (beginnerResult) {
      beginnerResult.innerHTML = `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 24px; font-weight: bold; color: ${actionColor}; margin-bottom: 10px;">${action}</div>
          <div style="color: #9aa6bf; font-size: 16px;">${t('beginner_recommendation_for')} ${symbol}</div>
          ${reliability > 0 ? `<div style="color: #9aa6bf; font-size: 14px; margin-top: 5px;">${escapeHtml(t('beginner_reliability'))}: ${escapeHtml(String(reliability))}%</div>` : ''}
        </div>
        
        ${entryValue !== '-' ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0;">
          <div style="background: #323544; padding: 15px; border-radius: 8px;">
            <div style="color: #9aa6bf; font-size: 14px; margin-bottom: 5px;">💰 ${entryLabel}:</div>
            <div style="font-size: 20px; font-weight: bold; color: #fff;">${entryValue}</div>
          </div>
          <div style="background: #323544; padding: 15px; border-radius: 8px;">
            <div style="color: #9aa6bf; font-size: 14px; margin-bottom: 5px;">🎯 ${targetLabel}:</div>
            <div style="font-size: 20px; font-weight: bold; color: #34d399;">${targetValue}</div>
          </div>
          <div style="background: #323544; padding: 15px; border-radius: 8px;">
            <div style="color: #9aa6bf; font-size: 14px; margin-bottom: 5px;">🛑 ${stopLabel}:</div>
            <div style="font-size: 20px; font-weight: bold; color: #ef4444;">${stopValue}</div>
          </div>
        </div>
        ` : ''}
        
        <div style="background: #323544; padding: 15px; border-radius: 8px; display: inline-block; margin-top: 10px;">
          <div style="color: #9aa6bf; font-size: 14px; margin-bottom: 12px;">${t('beginner_risk_level')}</div>
          <div style="margin-top: 8px;">
            <span style="background: ${riskColor}20; color: ${riskColor}; padding: 5px 15px; border-radius: 5px; font-weight: bold;">${riskLevel}</span>
          </div>
        </div>
        
        <div style="margin-top: 20px; color: #9aa6bf; font-size: 12px;">
          ${escapeHtml(t('beginner_simplified_analysis'))}
        </div>
      `;
      beginnerResult.style.display = 'block';
    }
  }

  // === Автоматические сигналы ===
  async function loadAutoSignalsSettings() {
    try {
      const res = await fetch('/api/auto_signals/settings');
      if (res.ok) {
        const settings = await res.json();
        const enableAutoSignals = document.getElementById('enableAutoSignals');
        const autoSignalSymbol = document.getElementById('autoSignalSymbol');
        const autoSignalCapital = document.getElementById('autoSignalCapital');
        const autoSignalTradingType = document.getElementById('autoSignalTradingType');
        const autoSignalStrategy = document.getElementById('autoSignalStrategy');
        const autoSignalRisk = document.getElementById('autoSignalRisk');
        const autoSignalConfirmation = document.getElementById('autoSignalConfirmation');
        const autoSignalMinReliability = document.getElementById('autoSignalMinReliability');
        const autoSignalCheckInterval = document.getElementById('autoSignalCheckInterval');
        const autoSignalsConfig = document.getElementById('autoSignalsConfig');
        
        if (enableAutoSignals) {
          enableAutoSignals.checked = settings.auto_signals_enabled || false;
          if (autoSignalsConfig) {
            autoSignalsConfig.style.display = enableAutoSignals.checked ? 'block' : 'none';
          }
        }
        if (autoSignalSymbol && settings.auto_signal_symbol) {
          autoSignalSymbol.value = settings.auto_signal_symbol;
        }
        if (autoSignalCapital && settings.auto_signal_capital) {
          autoSignalCapital.value = settings.auto_signal_capital;
        }
        if (autoSignalTradingType && settings.auto_signal_trading_type) {
          autoSignalTradingType.value = settings.auto_signal_trading_type;
        }
        if (autoSignalStrategy && settings.auto_signal_strategy) {
          autoSignalStrategy.value = settings.auto_signal_strategy;
        }
        if (autoSignalRisk && settings.auto_signal_risk) {
          autoSignalRisk.value = settings.auto_signal_risk;
        }
        if (autoSignalConfirmation && settings.auto_signal_confirmation) {
          autoSignalConfirmation.value = settings.auto_signal_confirmation;
          if (window.__autoSignalConfirmationUi && typeof window.__autoSignalConfirmationUi.applyValue === 'function') {
            window.__autoSignalConfirmationUi.applyValue(settings.auto_signal_confirmation);
          }
        }
        if (autoSignalMinReliability && settings.auto_signal_min_reliability) {
          autoSignalMinReliability.value = settings.auto_signal_min_reliability;
        }
        if (autoSignalCheckInterval && settings.auto_signal_check_interval) {
          autoSignalCheckInterval.value = settings.auto_signal_check_interval;
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки настроек автосигналов:', err);
    }
  }

  // Обработчик включения/выключения автосигналов
  const enableAutoSignals = document.getElementById('enableAutoSignals');
  const autoSignalsConfig = document.getElementById('autoSignalsConfig');
  if (enableAutoSignals && autoSignalsConfig) {
    enableAutoSignals.addEventListener('change', () => {
      autoSignalsConfig.style.display = enableAutoSignals.checked ? 'block' : 'none';
    });
  }

  // Сохранение настроек автосигналов
  const saveAutoSignalsSettingsBtn = document.getElementById('saveAutoSignalsSettingsBtn');
  if (saveAutoSignalsSettingsBtn) {
    saveAutoSignalsSettingsBtn.addEventListener('click', async () => {
      const enableAutoSignals = document.getElementById('enableAutoSignals');
      const autoSignalSymbol = document.getElementById('autoSignalSymbol');
      const autoSignalCapital = document.getElementById('autoSignalCapital');
      const autoSignalTradingType = document.getElementById('autoSignalTradingType');
      const autoSignalStrategy = document.getElementById('autoSignalStrategy');
      const autoSignalRisk = document.getElementById('autoSignalRisk');
      const autoSignalConfirmation = document.getElementById('autoSignalConfirmation');
      const autoSignalMinReliability = document.getElementById('autoSignalMinReliability');
      const autoSignalCheckInterval = document.getElementById('autoSignalCheckInterval');
      
      try {
        const res = await fetch('/api/auto_signals/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auto_signals_enabled: enableAutoSignals?.checked || false,
            auto_signal_symbol: autoSignalSymbol?.value || null,
            auto_signal_capital: parseFloat(autoSignalCapital?.value || 0) || null,
            auto_signal_trading_type: autoSignalTradingType?.value || null,
            auto_signal_strategy: autoSignalStrategy?.value || null,
            auto_signal_risk: parseFloat(autoSignalRisk?.value || 0) || null,
            auto_signal_confirmation: autoSignalConfirmation?.value || null,
            auto_signal_min_reliability: parseFloat(autoSignalMinReliability?.value || 60) || 60,
            auto_signal_check_interval: parseInt(autoSignalCheckInterval?.value || 60) || 60
          })
        });
        
        if (res.ok) {
          showToast('✅ Настройки автосигналов сохранены', 'success');
        } else {
          const data = await res.json();
          showToast('❌ Ошибка: ' + (data.error || 'Не удалось сохранить настройки'), 'error');
        }
      } catch (err) {
        console.error('Ошибка сохранения настроек:', err);
        showToast('❌ Ошибка сохранения настроек', 'error');
      }
    });
  }

  // Тестовая проверка автосигналов
  const testAutoSignalsBtn = document.getElementById('testAutoSignalsBtn');
  if (testAutoSignalsBtn) {
    testAutoSignalsBtn.addEventListener('click', async () => {
      testAutoSignalsBtn.disabled = true;
      testAutoSignalsBtn.textContent = '⏳ Проверка...';
      
      try {
        const res = await fetch('/api/auto_signals/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await res.json();
        
        if (res.ok) {
          showToast('✅ Тестовая проверка выполнена успешно', 'success');
        } else {
          showToast('❌ Ошибка: ' + (data.error || 'Не удалось выполнить проверку'), 'error');
        }
      } catch (err) {
        console.error('Ошибка тестовой проверки:', err);
        showToast('❌ Ошибка тестовой проверки', 'error');
      } finally {
        testAutoSignalsBtn.disabled = false;
        testAutoSignalsBtn.textContent = t('test_auto_signals') || 'Тестовая проверка';
      }
    });
  }

  // Отправка сообщения о проблеме
  const sendProblemMessageBtn = document.getElementById('sendProblemMessageBtn');
  if (sendProblemMessageBtn) {
    sendProblemMessageBtn.addEventListener('click', async () => {
      const problemMessage = document.getElementById('problemMessage');
      const message = problemMessage?.value?.trim();
      
      if (!message) {
        showToast(t('enter_message') || '⚠️ Введите сообщение', 'error');
        return;
      }
      
      sendProblemMessageBtn.disabled = true;
      const originalText = sendProblemMessageBtn.textContent;
      sendProblemMessageBtn.textContent = t('toast_sending') || '⏳ Отправка...';
      
      try {
        const res = await fetch('/api/send_problem_message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, language: currentLanguage })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          showToast(data.message || ('✅ ' + (t('error_message_sent') || 'Сообщение отправлено')), 'success');
          if (problemMessage) problemMessage.value = '';
        } else {
          showToast('❌ ' + (data.error || t('error_message_failed') || 'Не удалось отправить сообщение'), 'error');
        }
      } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
        showToast('❌ ' + (t('error_message_failed') || 'Ошибка отправки сообщения'), 'error');
      } finally {
        sendProblemMessageBtn.disabled = false;
        sendProblemMessageBtn.textContent = originalText;
      }
    });
  }

  // Сохранение настроек уведомлений
  const saveNotificationSettingsBtn = document.getElementById('saveNotificationSettingsBtn');
  if (saveNotificationSettingsBtn) {
    saveNotificationSettingsBtn.addEventListener('click', async () => {
      const enableEmailNotifications = document.getElementById('enableEmailNotifications');
      const enableTelegramNotifications = document.getElementById('enableTelegramNotifications');
      const telegramChatId = document.getElementById('telegramChatId');
      
      saveNotificationSettingsBtn.disabled = true;
      const originalText = saveNotificationSettingsBtn.textContent;
      saveNotificationSettingsBtn.textContent = t('toast_saving');
      
      try {
        const res = await fetch('/api/save_notification_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enable_email: enableEmailNotifications?.checked || false,
            enable_telegram: enableTelegramNotifications?.checked || false,
            telegram_chat_id: telegramChatId?.value?.trim() || null,
            language: currentLanguage
          })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          showToast(t('toast_notification_settings_saved'), 'success');
        } else {
          showToast('❌ Ошибка: ' + (data.error || 'Не удалось сохранить настройки'), 'error');
        }
      } catch (err) {
        console.error('Ошибка сохранения настроек уведомлений:', err);
        showToast(t('toast_notification_settings_failed'), 'error');
      } finally {
        saveNotificationSettingsBtn.disabled = false;
        saveNotificationSettingsBtn.textContent = originalText;
      }
    });
  }

  // Тест Telegram уведомления
  const testTelegramNotificationBtn = document.getElementById('testTelegramNotificationBtn');
  if (testTelegramNotificationBtn) {
    testTelegramNotificationBtn.addEventListener('click', async () => {
      testTelegramNotificationBtn.disabled = true;
      const originalText = testTelegramNotificationBtn.textContent;
      testTelegramNotificationBtn.textContent = t('toast_sending');

      try {
        const res = await fetch('/api/test_telegram_notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: currentLanguage })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(t('toast_test_telegram_sent'), 'success');
        } else {
          showToast('❌ ' + (data.error || t('toast_test_telegram_failed')), 'error', 7000);
        }
      } catch (err) {
        console.error('Ошибка тестового Telegram уведомления:', err);
        showToast(t('toast_test_telegram_failed'), 'error', 7000);
      } finally {
        testTelegramNotificationBtn.disabled = false;
        testTelegramNotificationBtn.textContent = originalText;
      }
    });
  }

  // Сохранение настроек торговли
  const saveTradingSettingsBtn = document.getElementById('saveTradingSettingsBtn');
  if (saveTradingSettingsBtn) {
    saveTradingSettingsBtn.addEventListener('click', async () => {
      const exchangeSpread = document.getElementById('exchangeSpread');
      
      saveTradingSettingsBtn.disabled = true;
      const originalText = saveTradingSettingsBtn.textContent;
      saveTradingSettingsBtn.textContent = '⏳ Сохранение...';
      
      try {
        const spreadValue = parseFloat(exchangeSpread?.value || 0);
        
        const res = await fetch('/api/save_trading_settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchange_spread: spreadValue
          })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          showToast('✅ Настройки торговли сохранены', 'success');
        } else {
          showToast('❌ Ошибка: ' + (data.error || 'Не удалось сохранить настройки'), 'error');
        }
      } catch (err) {
        console.error('Ошибка сохранения настроек торговли:', err);
        showToast('❌ Ошибка сохранения настроек', 'error');
      } finally {
        saveTradingSettingsBtn.disabled = false;
        saveTradingSettingsBtn.textContent = originalText;
      }
    });
  }
});

// === Функция отображения кривой баланса бэктеста ===
function displayBacktestEquityCurve(backtestData) {
  const container = document.getElementById('backtestChartContainer');
  const canvas = document.getElementById('backtestChart');
  
  if (!container || !canvas || !backtestData || !backtestData.equity_curve) {
    return;
  }

  container.classList.remove('hidden');

  // Уничтожаем предыдущий график, если он существует
  if (window.backtestChartInstance) {
    window.backtestChartInstance.destroy();
  }

  const equityCurve = backtestData.equity_curve;
  const labels = equityCurve.map((_, index) => index + 1);

  const axisColor = '#9aa6bf';
  const gridColor = 'rgba(148, 163, 184, 0.15)';
  const capitalLabel = t('compare_capital') || 'Capital';
  const periodLabel = t('compare_period') || 'Period';

  window.backtestChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: capitalLabel,
        data: equityCurve,
        borderColor: 'rgb(63, 169, 245)',
        backgroundColor: 'rgba(63, 169, 245, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: axisColor,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 19, 32, 0.95)',
          titleColor: '#e8e8e8',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(44, 51, 80, 0.9)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return `${capitalLabel}: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: axisColor,
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          },
          grid: {
            color: gridColor
          },
          title: {
            display: true,
            text: capitalLabel,
            color: axisColor
          }
        },
        x: {
          ticks: {
            color: axisColor
          },
          grid: {
            color: gridColor
          },
          title: {
            display: true,
            text: periodLabel,
            color: axisColor
          }
        }
      }
    }
  });
}

// === Функция отображения сравнительного бэктеста всех стратегий ===
function displayCompareBacktest(allStrategiesData) {
  const container = document.getElementById('compareBacktestContainer');
  const resultsDiv = document.getElementById('compareBacktestResults');
  const chartCanvas = document.getElementById('compareBacktestChart');
  const tableDiv = document.getElementById('compareBacktestTable');
  
  if (!container || !resultsDiv || !chartCanvas || !tableDiv) {
    return;
  }

  container.classList.remove('hidden');
  resultsDiv.style.display = 'block';

  // ✅ ИСПРАВЛЕНО: Цвета для каждой стратегии (используем ключи для перевода)
  const strategyColorMap = {
    'Консервативная': { color: 'rgb(34, 211, 153)', key: 'conservative' },
    'Сбалансированная': { color: 'rgb(63, 169, 245)', key: 'balanced' },
    'Агрессивная': { color: 'rgb(239, 68, 68)', key: 'aggressive' },
    'Conservative': { color: 'rgb(34, 211, 153)', key: 'conservative' },
    'Balanced': { color: 'rgb(63, 169, 245)', key: 'balanced' },
    'Aggressive': { color: 'rgb(239, 68, 68)', key: 'aggressive' },
    'Консервативна': { color: 'rgb(34, 211, 153)', key: 'conservative' },
    'Збалансована': { color: 'rgb(63, 169, 245)', key: 'balanced' },
    'Агресивна': { color: 'rgb(239, 68, 68)', key: 'aggressive' }
  };

  // Подготовка данных для графика
  const datasets = [];
  const maxLength = Math.max(...Object.values(allStrategiesData).map(s => s.equity_curve ? s.equity_curve.length : 0));
  const labels = Array.from({ length: maxLength }, (_, i) => i + 1);

  for (const [strategyName, data] of Object.entries(allStrategiesData)) {
    if (data.equity_curve && data.equity_curve.length > 0) {
      // ✅ ИСПРАВЛЕНО: Переводим название стратегии
      const strategyInfo = strategyColorMap[strategyName] || { color: 'rgb(128, 128, 128)', key: null };
      const translatedName = strategyInfo.key ? t(strategyInfo.key) : strategyName;
      
      datasets.push({
        label: translatedName,
        data: data.equity_curve,
        borderColor: strategyInfo.color,
        backgroundColor: strategyInfo.color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4
      });
    }
  }

  // Уничтожаем предыдущий график, если он существует
  if (window.compareBacktestChartInstance) {
    window.compareBacktestChartInstance.destroy();
  }

  // Создаем график сравнения
  const axisColor = '#9aa6bf';
  const gridColor = 'rgba(148, 163, 184, 0.15)';
  const capitalLabel = t('compare_capital') || 'Capital';
  const periodLabel = t('compare_period') || 'Period';

  window.compareBacktestChartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: axisColor,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 19, 32, 0.95)',
          titleColor: '#e8e8e8',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(44, 51, 80, 0.9)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: axisColor,
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          },
          grid: {
            color: gridColor
          },
          title: {
            display: true,
            text: capitalLabel,
            color: axisColor
          }
        },
        x: {
          ticks: {
            color: axisColor
          },
          grid: {
            color: gridColor
          },
          title: {
            display: true,
            text: periodLabel,
            color: axisColor
          }
        }
      }
    }
  });

  // ✅ ИСПРАВЛЕНО: Создаем сравнительную таблицу с переводами
  let tableHTML = '<table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: #2a2d3a; border-radius: 8px; overflow: hidden;">';
  tableHTML += '<thead><tr style="background: #3a3f52; color: #fff;">';
  tableHTML += `<th style="padding: 12px; text-align: left; border-bottom: 2px solid #3fa9f5;">${t('compare_strategy')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_win_rate')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_profit')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_trades')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_drawdown')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_avg_rr')}</th>`;
  tableHTML += `<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">${t('compare_final_capital')}</th>`;
  tableHTML += '</tr></thead><tbody>';

  // Сортируем стратегии по прибыли (от лучшей к худшей)
  const sortedStrategies = Object.entries(allStrategiesData).sort((a, b) => 
    (b[1].total_profit_pct || 0) - (a[1].total_profit_pct || 0)
  );

  // ✅ ИСПРАВЛЕНО: Маппинг кодов стратегий в ключи переводов
  const getStrategyTranslationKey = (name) => {
    if (!name) return null;
    const nameLower = name.toLowerCase().trim();
    
    // Определяем ключ перевода
    if (nameLower.includes('conservative') || name === 'Консервативная' || name === 'Консервативна') return 'conservative';
    if (nameLower.includes('balanced') || name === 'Сбалансированная' || name === 'Збалансована') return 'balanced';
    if (nameLower.includes('aggressive') || name === 'Агрессивная' || name === 'Агресивна') return 'aggressive';
    
    return null;
  };

  sortedStrategies.forEach(([strategyName, data], index) => {
    // ✅ ИСПРАВЛЕНО: Переводим название стратегии
    const strategyKey = getStrategyTranslationKey(strategyName);
    const displayName = strategyKey ? t(strategyKey) : strategyName;
    const strategyInfo = strategyColorMap[strategyName] || { color: 'rgb(128, 128, 128)' };
    
    const rowColor = index % 2 === 0 ? '#2a2d3a' : '#323544';
    const profitColor = data.total_profit_pct >= 0 ? '#22d399' : '#ef4444';
    const winRateColor = data.win_rate >= 50 ? '#22d399' : data.win_rate >= 40 ? '#f59e0b' : '#ef4444';
    
    tableHTML += `<tr style="background: ${rowColor}; color: #e8e8e8;">`;
    tableHTML += `<td style="padding: 12px; font-weight: bold; color: ${strategyInfo.color};">${escapeHtml(displayName)}</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right; color: ${winRateColor};">${data.win_rate.toFixed(1)}%</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right; color: ${profitColor};">${data.total_profit_pct >= 0 ? '+' : ''}${data.total_profit_pct.toFixed(2)}%</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right;">${data.total_trades || 0}</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right; color: #ef4444;">${data.max_drawdown.toFixed(2)}%</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right;">${data.avg_rr.toFixed(2)}</td>`;
    tableHTML += `<td style="padding: 12px; text-align: right; color: ${profitColor};">$${data.final_capital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table>';
  tableDiv.innerHTML = tableHTML;

  // Скрываем кнопку "Запустить сравнительный бэктест", так как данные уже есть
  const runCompareBtn = document.getElementById('runCompareBacktestBtn');
  if (runCompareBtn) {
    runCompareBtn.style.display = 'none';
  }
}

// === Обработка случая, когда сравнительных данных нет ===
function hideCompareBacktest() {
  const container = document.getElementById('compareBacktestContainer');
  if (container) {
    container.classList.add('hidden');
  }
  const runCompareBtn = document.getElementById('runCompareBacktestBtn');
  if (runCompareBtn) {
    runCompareBtn.style.display = 'block';
  }
}

  // ✅ Fallback: Обновление цены через REST API, если WebSocket не работает
  let priceUpdateInterval = null;

  window.startPriceUpdateFallback = function(symbol, timeframe = '1h') {
    // Останавливаем предыдущий интервал, если есть
    if (priceUpdateInterval) {
      clearInterval(priceUpdateInterval);
    }
    
    // ✅ ИСПРАВЛЕНО: Сохраняем символ в currentSymbol для использования в замыкании
    currentSymbol = symbol;
    currentTimeframe = timeframe;
    
    console.log(`🔄 Запуск fallback обновления цены для ${symbol} через Binance API`);
    
    // Обновляем цену каждые 2 секунды через прямой запрос к Binance API
    priceUpdateInterval = setInterval(async () => {
      // ✅ НОВОЕ: Сохраняем символ в начале итерации
      const activeSymbol = currentSymbol;
      const activeTimeframe = currentTimeframe;
      
      if (!activeSymbol) {
        console.warn('⚠️ currentSymbol не установлен, останавливаем fallback');
        if (priceUpdateInterval) {
          clearInterval(priceUpdateInterval);
          priceUpdateInterval = null;
        }
        return;
      }
      
      try {
        const apiSymbol = activeSymbol.replace('/', '').toUpperCase();
        // Используем ticker price endpoint - быстрее и проще
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${apiSymbol}`);
        
        if (!response.ok) {
          // Если прямой запрос не работает, пробуем через наш API
          const fallbackResponse = await fetch(`/api/klines?symbol=${encodeURIComponent(activeSymbol)}&interval=${activeTimeframe}&limit=1`);
          if (!fallbackResponse.ok) {
            return;
          }
          const klines = await fallbackResponse.json();
          if (klines && klines.length > 0) {
            const latestKline = klines[klines.length - 1];
            const price = parseFloat(latestKline[4]);
            // ✅ НОВОЕ: Проверяем символ перед обновлением
            if (currentSymbol === activeSymbol && typeof updatePriceFromFallback === 'function') {
              updatePriceFromFallback(price, activeSymbol, activeTimeframe);
            }
          }
          return;
        }
        
        const tickerData = await response.json();
        // ✅ НОВОЕ: Проверяем символ в ответе API
        if (tickerData.symbol && tickerData.symbol !== apiSymbol) {
          console.warn(`⚠️ API вернул неправильный символ: ${tickerData.symbol}, ожидали ${apiSymbol}`);
          return;
        }
        
        const price = parseFloat(tickerData.price); // Ticker price endpoint возвращает {symbol: "...", price: "12345.67"}
        
        if (!isNaN(price) && price > 0) {
          // ✅ НОВОЕ: Проверяем символ перед обновлением
          if (currentSymbol === activeSymbol && typeof updatePriceFromFallback === 'function') {
            updatePriceFromFallback(price, activeSymbol, activeTimeframe);
          }
        }
      } catch (error) {
        console.warn('⚠️ Ошибка обновления цены через Binance API:', error);
        // Пробуем через наш API как fallback
        try {
          const apiSymbol = activeSymbol.replace('/', '').toUpperCase();
          const fallbackResponse = await fetch(`/api/klines?symbol=${encodeURIComponent(activeSymbol)}&interval=${activeTimeframe}&limit=1`);
          if (fallbackResponse.ok) {
            const klines = await fallbackResponse.json();
            if (klines && klines.length > 0) {
              const latestKline = klines[klines.length - 1];
              const price = parseFloat(latestKline[4]);
              // ✅ НОВОЕ: Проверяем символ перед обновлением
              if (currentSymbol === activeSymbol && typeof updatePriceFromFallback === 'function') {
                updatePriceFromFallback(price, activeSymbol, activeTimeframe);
              }
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Ошибка fallback обновления цены:', fallbackError);
        }
      }
    }, 2000); // Обновляем каждые 2 секунды
  };

  // ✅ Вспомогательная функция для обновления цены (используется и в fallback, и в основном коде)
  function updatePriceFromFallback(price, symbol, timeframe) {
    // ✅ УЛУЧШЕНО: Строгая проверка символа
    if (!currentSymbol) {
      console.warn('⚠️ currentSymbol не установлен, игнорируем обновление');
      return;
    }
    
    if (symbol !== currentSymbol) {
      console.warn(`⚠️ Игнорируем обновление для ${symbol}, текущий символ: ${currentSymbol}`);
      return;
    }
    
    if (!realtimeChart) {
      console.warn('⚠️ График не инициализирован');
      return;
    }
    
    if (!isNaN(price) && price > 0) {
      const now = new Date();

      // ✅ FIX: если история не загрузилась (пустой график), инициализируем первую точку
      if (priceHistory.length === 0) {
        priceHistory.push(price);
        timeHistory.push(formatTime(now, timeframe));
      } else {
        // Обновляем последнюю цену в истории
        priceHistory[priceHistory.length - 1] = price;
        timeHistory[timeHistory.length - 1] = formatTime(now, timeframe);
      }

        // Обновляем график
        if (realtimeChart) {
          realtimeChart.data.labels = [...timeHistory];
          realtimeChart.data.datasets[0].data = [...priceHistory];
          
          // Обновляем линии входа/выхода, если они есть
          if (currentAnalysis && realtimeChart.data.datasets.length > 1) {
            for (let i = 1; i < realtimeChart.data.datasets.length; i++) {
              const dataset = realtimeChart.data.datasets[i];
              if (dataset.label === t('chart_entry') || dataset.label === 'Entry' || 
                  dataset.label === t('chart_stop_loss') || dataset.label === 'Stop Loss' || 
                  dataset.label === t('chart_take_profit') || dataset.label === 'Take Profit' ||
                  dataset.label === t('chart_trailing_stop') || dataset.label === 'Trailing Stop Loss') {
                const lineValue = dataset.data && dataset.data.length > 0 
                  ? (dataset.data[0] || dataset.data[dataset.data.length - 1])
                  : null;
                if (lineValue !== null) {
                  dataset.data = Array(priceHistory.length).fill(lineValue);
                }
              }
            }
          }
          
          updateRealtimeChartScale();
          realtimeChart.update('none');
        }
        
        // Обновляем информацию о цене
        updatePriceInfo(price, symbol);
        lastPrice = price;
        
        // Обновляем трейлинг-стоп в реальном времени
        if (trailingStopState && trailingStopState.enabled) {
          updateTrailingStop(price);
        }
        
        // ✅ НОВОЕ: Проверяем TP/SL если есть анализ (с проверкой наличия функции)
        if (currentAnalysis && typeof checkSignalLevels === 'function') {
          checkSignalLevels(price);
        }
    }
  }

  window.stopPriceUpdateFallback = function() {
    if (priceUpdateInterval) {
      clearInterval(priceUpdateInterval);
      priceUpdateInterval = null;
      console.log('🛑 Остановлен fallback обновления цены');
    }
  };
