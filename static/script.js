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
  
  // Обновляем кнопку режима новичка в зависимости от текущего состояния
  const modeToggleBtn = document.getElementById('modeToggleBtn');
  // Проверяем глобальную переменную isBeginnerMode (объявлена в DOMContentLoaded)
  if (modeToggleBtn && window.isBeginnerMode !== undefined) {
    modeToggleBtn.textContent = window.isBeginnerMode ? t('beginner_mode_advanced') : t('beginner_mode');
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

document.addEventListener("DOMContentLoaded", () => {
  const tradingType = document.getElementById("trading_type");
  const tfInfo = document.getElementById("tfInfo");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const progress = document.getElementById("progressBar");
  const progressBar = progress ? progress.querySelector(".bar") : null;
  const result = document.getElementById("result");
  const reportText = document.getElementById("reportText");
  const downloadBtn = document.getElementById("downloadZip");
  const downloadStatsBtn = document.getElementById("downloadStats");
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
  tradingType.addEventListener("change", () => {
    const tradingTypeValue = tradingType.value;
    const recommendedTf = timeframes[tradingTypeValue] || "1h";
    tfInfo.textContent = t("recommended") + ": " + recommendedTf;
    
    // Если выбран "Автоматически", обновляем текст, но не меняем значение
    if (timeframeSelect && timeframeSelect.value === "auto") {
      // Значение остается "auto", но показываем рекомендацию
    }
  });

  // Обновляем информацию при изменении выбранного таймфрейма
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", () => {
      if (timeframeSelect.value === "auto") {
        const tradingTypeValue = tradingType.value;
        const recommendedTf = timeframes[tradingTypeValue] || "1h";
        tfInfo.textContent = t("recommended") + ": " + recommendedTf;
      } else {
        tfInfo.textContent = t("selected") + ": " + timeframeSelect.value;
      }
    });
  }
  
  // === Инициализация кастомного дропдауна для языка ===
  function initCustomDropdown() {
    const dropdown = document.getElementById('languageDropdown');
    const toggle = document.getElementById('languageToggleBtn');
    const menu = document.getElementById('languageDropdownMenu');
    const toggleText = document.getElementById('languageToggleText');
  
    if (!dropdown || !toggle || !menu) return;
    
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
    
    // Открытие/закрытие меню
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });
    
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
      updateTimeframeInfo();
        
        // Обновляем язык на странице логина
        if (typeof updateLoginTranslations === 'function') {
          updateLoginTranslations();
        }
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
  }
  
  // Инициализируем кастомный дропдаун
  initCustomDropdown();
  
  // Загружаем план пользователя
  fetch('/api/user_info')
    .then(res => res.json())
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
          // Устанавливаем выбранные индикаторы
          const confirmationSelect = document.getElementById("confirmation");
          const indicatorValue = data.indicators.join("+");
          
          // Ищем существующий вариант или создаём новый
          let found = false;
          for (let option of confirmationSelect.options) {
            if (option.value === indicatorValue) {
              confirmationSelect.value = indicatorValue;
              found = true;
              break;
            }
          }
          
          if (!found) {
            // Создаём новый option
            const newOption = document.createElement("option");
            newOption.value = indicatorValue;
            newOption.textContent = data.indicators.join(" + ");
            confirmationSelect.appendChild(newOption);
            confirmationSelect.value = indicatorValue;
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
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function mdTableToHtml(lines) {
    const rows = lines.map(l => l.trim()).filter(l => l && !/^[-| ]+$/.test(l));
    if (!rows.length) return "";
    const cells = rows.map(r => r.split("|").map(c => c.trim()).filter(Boolean));
    const thead = cells[0];
    const body = cells.slice(1);
    let html = '<table class="report-table"><thead><tr>';
    thead.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
    html += "</tr></thead><tbody>";
    body.forEach(r => {
      html += "<tr>";
      thead.forEach((_, i) => {
        html += `<td>${escapeHtml(r[i] || "")}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderReport(md) {
    if (!md) return "";
    const lines = md.replace(/\r/g, "").split("\n");
    const header = { title: "", generated: "", bias: "" };
    let i = 0;
    // Header block
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith("=== ") && line.endsWith(" ===")) header.title = line.replace(/===|=/g, "").trim();
      else if (line.startsWith("Сгенерировано:")) header.generated = line.replace("Сгенерировано:", "").trim();
      else if (/Текущий рынок/.test(line)) header.bias = line.replace(/Текущий рынок.*?:/i, "").trim();
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

    // Build HTML
    let html = '<div class="report">';
    html += `<div class="report-header"><div class="report-title">${escapeHtml(header.title || "Аналитический отчёт")}</div>`;
    if (header.bias) {
      const isBull = /Бычий|Uptrend/i.test(header.bias);
      const isBear = /Медвежий|Downtrend/i.test(header.bias);
      const tone = isBull ? "bull" : isBear ? "bear" : "neutral";
      html += `<div class="chip ${tone}">${escapeHtml(header.bias)}</div>`;
    }
    if (header.generated) {
      html += `<div class="report-meta">Сгенерировано: ${escapeHtml(header.generated)}</div>`;
    }
    html += "</div>";

    sections.forEach(sec => {
      const title = sec.title;
      const content = sec.content;
      // Detect and convert tables in-place
      let cardsHtml = "";
      // Special handling for Levels section: split Long/Short blocks
      if (/🎯 Уровни/.test(title)) {
        const joined = content.join("\n");
        const parts = joined.split(/\*\*Шорт\*\*/i);
        const longPart = parts[0].split(/\*\*Лонг\*\*/i)[1] || "";
        const shortPart = parts[1] || "";
        const longLines = longPart.trim().split("\n").filter(Boolean);
        const shortLines = shortPart.trim().split("\n").filter(Boolean);
        cardsHtml += `<div class="subcards">`;
        if (longLines.length) {
          const tblLines = longLines.filter(l => l.includes("|"));
          cardsHtml += `<div class="card"><div class="card-title">Лонг</div>${mdTableToHtml(tblLines)}</div>`;
        }
        if (shortLines.length) {
          const tblLines = shortLines.filter(l => l.includes("|"));
          cardsHtml += `<div class="card"><div class="card-title">Шорт</div>${mdTableToHtml(tblLines)}</div>`;
        }
        cardsHtml += `</div>`;
      } else if (content.some(l => l.includes("|"))) {
        const tableLines = content.filter(l => l.includes("|"));
        cardsHtml += mdTableToHtml(tableLines);
      } else if (/^- /.test(content.join("\n"))) {
        // bullet list
        const items = content.filter(l => l.trim().startsWith("- ")).map(l => l.trim().slice(2));
        cardsHtml += '<ul class="report-list">' + items.map(it => `<li>${escapeHtml(it)}</li>`).join("") + "</ul>";
      } else {
        const text = content.join("\n").trim();
        if (text) {
          // Обрабатываем специальные маркеры
          let processedText = text;
          
          // Сначала обрабатываем [DIVIDER] - заменяем на специальный маркер, который не будет экранирован
          processedText = processedText.replace(/\[DIVIDER\]/g, '___DIVIDER_MARKER___');
          
          // Обрабатываем строки вида "💰 Общая прибыль: 123%" - сохраняем на одной строке
          // Заменяем переносы строк после двоеточия на пробел
          processedText = processedText.replace(/:\s*\n/g, ': ');
          
          // Обрабатываем Markdown жирный текст
          processedText = processedText.replace(/\*\*(.*?)\*\*/g, '___STRONG_START___$1___STRONG_END___');
          
          // Экранируем HTML
          processedText = escapeHtml(processedText);
          
          // Восстанавливаем наши специальные маркеры в HTML
          processedText = processedText.replace(/___DIVIDER_MARKER___/g, '<div class="backtest-divider"></div>');
          processedText = processedText.replace(/___STRONG_START___(.*?)___STRONG_END___/g, '<strong>$1</strong>');
          
          // Разбиваем на строки для правильного отображения
          processedText = processedText.split('\n').map(line => {
            line = line.trim();
            if (!line) return '';
            // Если строка начинается с эмодзи или содержит двоеточие, сохраняем как есть
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

  // === Рендер демо при загрузке ===
  if (demoReportEl && reportText) {
    try {
      const demoMd = demoReportEl.textContent || "";
      if (demoMd.trim()) {
        reportText.innerHTML = renderReport(demoMd);
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
      showToast("⚠️ Неверное значение капитала. Используйте положительное число.", "error");
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

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
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
          trailing_percent: trailingPercent
          // Уведомления закомментированы - не нужны при ручном запуске анализа
          // enable_alerts: enableEmail,
          // enable_email: enableEmail,
          // alert_min_reliability: alertMinReliability
        })
      });

      const data = await res.json();
      stopProgress();

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
        return;
      }

      if (data.report_text) {
        reportText.innerHTML = renderReport(data.report_text);

        result.classList.remove("demo");
        showToast(t("analysis_complete"), "success");
        
        // Показываем сообщение об оставшихся анализах для Free
        if (data.remaining_analyses !== undefined && data.remaining_analyses !== null) {
          showToast(t("free_analyses_left", { count: data.remaining_analyses }), "info", 5000);
        }

        // === Real-Time график ===
        // ИСПРАВЛЕНО: Не меняем символ графика при анализе - используем текущий график
        // Если график пустой или еще не подключен - подключаемся к символу из анализа
        if (!realtimeChart) {
          const ctx = document.getElementById('realtimeChart');
          if (ctx) {
            initRealtimeChart();
          }
        }
        
        // Если график пустой и нет подключения - подключаемся к символу из анализа
        if (realtimeChart && (!wsConnection || wsConnection.readyState === WebSocket.CLOSED)) {
          const analysisSymbol = data.symbol || symbol.value || 'BTC/USDT';
          // ИСПРАВЛЕНО: Получаем элемент напрямую, так как chartTimeframeSelect определена только в другом блоке
          const chartTimeframeSelectEl = document.getElementById('chartTimeframe');
          const analysisTimeframe = chartTimeframeSelectEl?.value || '1h';
          
          // Подключаемся к символу из анализа, если график пустой
          if (priceHistory.length === 0) {
            connectWebSocket(analysisSymbol, analysisTimeframe);
          }
        }
        
        // Накладываем линии анализа, если они есть
        // ИСПРАВЛЕНО: Не меняем символ графика - используем текущий график независимо от символа анализа
        if (data.entry_price && data.stop_loss && data.take_profit) {
          // Удаляем старые линии анализа, если есть (оставляем только график цены)
          if (realtimeChart && realtimeChart.data.datasets.length > 1) {
            realtimeChart.data.datasets = [realtimeChart.data.datasets[0]];
            realtimeChart.update();
          }
          
          // Отображаем точки входа/выхода на текущем графике
          displaySignalLevels({
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
                showToast("📦 ZIP-файл сохранён", "success");
              } else {
                showToast("⚠️ Сохранение отменено", "error");
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
            showToast("📦 ZIP-файл загружен", "success");
          } catch (err) {
            console.error("Ошибка скачивания:", err);
            showToast("⚠️ Не удалось сохранить файл", "error");
          }
          };
        } else if (downloadBtn) {
          // Если нет данных ZIP - отключаем обработчик
          downloadBtn.onclick = null;
          downloadBtn.disabled = true;
        }
      } else {
        showToast("⚠️ Не удалось получить отчёт", "error");
        // ИСПРАВЛЕНО: Включаем кнопки даже если нет отчета (для предыдущего анализа)
        if (downloadBtn) {
          downloadBtn.disabled = false;
          downloadBtn.classList.remove('disabled-free');
        }
        if (downloadStatsBtn && userPlan && userPlan !== 'free') {
          downloadStatsBtn.disabled = false;
          downloadStatsBtn.classList.remove('disabled-free');
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
      const res = await fetch("/download_user_stats_bundle");
      if (!res.ok) {
        showToast("⚠️ Нет данных для отчёта или ошибка при загрузке", "error");
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
              showToast("📦 Архив сохранён", "success");
            } else {
              showToast("⚠️ Сохранение отменено", "error");
            }
          } catch (err) {
            console.error("Ошибка сохранения через мост:", err);
            a.href = url;
            a.download = "user_stats_bundle.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("📊 Статистика успешно загружена", "success");
          }
        };
        reader.onerror = () => {
          a.href = url;
          a.download = "user_stats_bundle.zip";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast("📊 Статистика успешно загружена", "success");
        };
        reader.readAsDataURL(blob);
      } else {
        a.href = url;
        a.download = "user_stats_bundle.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("📊 Статистика успешно загружена", "success");
      }
    } catch (err) {
      console.error("Ошибка при скачивании статистики:", err);
      showToast("❌ Ошибка при скачивании статистики", "error");
    } finally {
      downloadStatsBtn.disabled = false;
    }
  });

  // === Загрузка анализа стратегий ===
  if (loadStrategyAnalysisBtn && strategyAnalysisDiv) {
    loadStrategyAnalysisBtn.addEventListener("click", async () => {
      // Проверяем, не отключена ли кнопка для Free плана
      if (loadStrategyAnalysisBtn.disabled || loadStrategyAnalysisBtn.classList.contains('disabled-free')) {
        return;
      }
      loadStrategyAnalysisBtn.disabled = true;
      loadStrategyAnalysisBtn.textContent = "⏳ Загрузка...";
      
      try {
        const res = await fetch("/api/strategy_analysis");
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
            // Разбиваем текст на строки и добавляем переносы для читаемости
            let formattedSummary = data.auto_summary
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n\n+/g, '\n\n') // Убираем множественные переносы
              .replace(/\n/g, '<br>'); // Заменяем переносы строк на <br>
            autoSummaryText.innerHTML = formattedSummary;
          } else {
            autoSummaryText.innerHTML = "Недостаточно данных для анализа.";
          }
        }
        
        // Таблица стратегий
        const strategyStatsTable = document.getElementById("strategyStatsTable");
        if (strategyStatsTable && data.strategy_stats) {
          const stats = data.strategy_stats;
          if (Object.keys(stats).length === 0) {
            strategyStatsTable.innerHTML = "<p>Нет данных о стратегиях.</p>";
          } else {
            let tableHtml = '<table class="report-table"><thead><tr>';
            tableHtml += '<th>Стратегия</th>';
            tableHtml += '<th>Сделок</th>';
            tableHtml += '<th>Успешных</th>';
            tableHtml += '<th>Win Rate</th>';
            tableHtml += '<th>Средняя прибыль (%)</th>';
            tableHtml += '<th>Общая прибыль (%)</th>';
            tableHtml += '<th>Макс. прибыль</th>';
            tableHtml += '<th>Макс. убыток</th>';
            tableHtml += '</tr></thead><tbody>';
            
            // Сортируем по средней прибыли
            const sortedStrategies = Object.entries(stats).sort((a, b) => 
              b[1].avg_profit_percent - a[1].avg_profit_percent
            );
            
            for (const [strategy, stat] of sortedStrategies) {
              const profitColor = stat.avg_profit_percent >= 0 ? "#34D399" : "#EF4444";
              tableHtml += '<tr>';
              tableHtml += `<td><strong>${escapeHtml(strategy)}</strong></td>`;
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
          const betterIcon = bench.better === "strategy" ? "✅" : "⚠️";
          const betterText = bench.better === "strategy" ? "Стратегия лучше" : "Buy & Hold лучше";
          const diffColor = bench.difference >= 0 ? "#34D399" : "#EF4444";
          
          let benchmarkHtml = '<div class="benchmark-stats">';
          benchmarkHtml += `<div class="benchmark-card">`;
          benchmarkHtml += `<div class="benchmark-metric">`;
          benchmarkHtml += `<span class="metric-label">📊 Доходность стратегии:</span>`;
          benchmarkHtml += `<span class="metric-value" style="color: ${bench.strategy_return >= 0 ? '#34D399' : '#EF4444'}">${bench.strategy_return.toFixed(2)}%</span>`;
          benchmarkHtml += `</div>`;
          benchmarkHtml += `<div class="benchmark-metric">`;
          benchmarkHtml += `<span class="metric-label">📈 Доходность Buy & Hold:</span>`;
          benchmarkHtml += `<span class="metric-value" style="color: ${bench.buy_hold_return >= 0 ? '#34D399' : '#EF4444'}">${bench.buy_hold_return.toFixed(2)}%</span>`;
          benchmarkHtml += `</div>`;
          benchmarkHtml += `<div class="benchmark-metric highlight">`;
          benchmarkHtml += `<span class="metric-label">${betterIcon} Разница:</span>`;
          benchmarkHtml += `<span class="metric-value" style="color: ${diffColor}">${bench.difference >= 0 ? '+' : ''}${bench.difference.toFixed(2)}%</span>`;
          benchmarkHtml += `<span class="metric-note">(${betterText})</span>`;
          benchmarkHtml += `</div>`;
          benchmarkHtml += `</div>`;
          benchmarkHtml += `<p class="benchmark-note">Сравнение основано на ${bench.total_trades} сделках</p>`;
          benchmarkHtml += `<div class="benchmark-explanation">`;
          benchmarkHtml += `<p><strong>Как считается:</strong></p>`;
          benchmarkHtml += `<ul>`;
          benchmarkHtml += `<li><strong>Доходность стратегии:</strong> средняя прибыль/убыток на одну сделку (сумма всех profit_loss_percent / количество сделок)</li>`;
          benchmarkHtml += `<li><strong>Доходность Buy & Hold:</strong> средняя доходность "купить и держать" для всех инструментов за период (цена_конец - цена_начало) / цена_начало × 100%</li>`;
          benchmarkHtml += `<li><strong>Разница:</strong> доходность стратегии - доходность Buy & Hold. Положительное значение означает, что стратегия лучше.</li>`;
          benchmarkHtml += `</ul>`;
          benchmarkHtml += `</div>`;
          benchmarkHtml += `</div>`;
          
          benchmarkContent.innerHTML = benchmarkHtml;
          benchmarkComparison.classList.remove("hidden");
        } else if (benchmarkComparison) {
          benchmarkComparison.classList.add("hidden");
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
        
        showToast(`✅ Анализ загружен (${data.total_reports || 0} отчётов)`, "success");
      } catch (err) {
        console.error("Ошибка загрузки анализа:", err);
        showToast("❌ Ошибка при загрузке анализа", "error");
      } finally {
        loadStrategyAnalysisBtn.disabled = false;
        loadStrategyAnalysisBtn.textContent = "📈 Анализ стратегий";
      }
    });
  }

  // === Real-Time график и WebSocket ===
  let realtimeChart = null;
  let wsConnection = null;
  let currentAnalysis = null; // Хранит entry_price, stop_loss, take_profit, direction
  let priceHistory = []; // История цен для графика
  let timeHistory = []; // История времени
  let lastPrice = null; // Последняя цена для расчета изменения
  let wsReconnectTimer = null; // Таймер для переподключения
  let wsManuallyStopped = false; // Флаг ручной остановки
  let currentSymbol = null; // Текущий символ для WebSocket
  let currentTimeframe = null; // Текущий таймфрейм для WebSocket
  let linesHideTimer = null; // Таймер для автоматического скрытия линий анализа

  // Инициализация графика
  function initRealtimeChart() {
    const ctx = document.getElementById('realtimeChart');
    if (!ctx) return;
    
    realtimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeHistory,
        datasets: [
          {
            label: 'Цена',
            data: priceHistory,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.1,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Отключаем для полного контроля размера
        animation: false, // Отключаем анимацию для производительности
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              color: '#e6e6e6', // Яркий цвет для меток
              font: {
                size: 12,
                weight: 'bold' // Жирный шрифт для лучшей видимости
              },
              callback: function(value) {
                return '$' + value.toFixed(2);
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            ticks: {
              maxTicksLimit: 15, // Уменьшаем для лучшей читаемости
              autoSkip: true,
              maxRotation: 45,
              minRotation: 0,
              color: '#e6e6e6', // Яркий цвет для меток
              font: {
                size: 11,
                weight: 'bold' // Жирный шрифт для лучшей видимости
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e6e6e6',
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 13
              },
              generateLabels: function(chart) {
                const original = Chart.defaults.plugins.legend.labels.generateLabels;
                const labels = original.call(this, chart);
                // Убеждаемся, что квадратики полностью закрашены
                labels.forEach(label => {
                  label.fillStyle = label.strokeStyle || label.fillStyle;
                });
                return labels;
              }
            }
          },
          tooltip: {
            padding: 12,
            displayColors: true,
            position: 'nearest', // Исправляем позиционирование
            intersect: false,
            callbacks: {
              title: function(context) {
                const label = context[0].label;
                // Для коротких таймфреймов день уже в label
                return 'Время: ' + label;
              },
              label: function(context) {
                const datasetLabel = context.dataset.label || '';
                const value = context.parsed.y;
                
                // Для линий Entry/Stop Loss/Take Profit показываем специальные метки
                if (datasetLabel === 'Entry') {
                  return '  Entry: $' + value.toFixed(2);
                } else if (datasetLabel === 'Stop Loss') {
                  return '  Stop Loss: $' + value.toFixed(2);
                } else if (datasetLabel === 'Take Profit') {
                  return '  Take Profit: $' + value.toFixed(2);
                } else {
                  return '  Цена: $' + value.toFixed(2);
                }
              },
              labelColor: function(context) {
                const datasetLabel = context.dataset.label || '';
                let color = context.dataset.borderColor || '#3fa9f5';
                
                // Определяем цвет для каждой линии
                if (datasetLabel === 'Entry') {
                  color = 'rgb(63, 169, 245)'; // Яркий синий
                } else if (datasetLabel === 'Stop Loss') {
                  color = 'rgb(239, 68, 68)'; // Красный
                } else if (datasetLabel === 'Take Profit') {
                  color = 'rgb(34, 211, 153)'; // Яркий зеленый
                }
                
                return {
                  borderColor: color,
                  backgroundColor: color
                };
              }
            }
          }
        }
      }
    });
  }

  // Функция форматирования времени в зависимости от таймфрейма
  function formatTime(date, timeframe = '1h') {
    const shortTimeframes = ['1m', '3m', '5m', '15m', '30m'];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Функция для определения, какой это день
    const getDayLabel = (date) => {
      const dateStr = date.toDateString();
      const todayStr = today.toDateString();
      const yesterdayStr = yesterday.toDateString();
      
      if (dateStr === todayStr) return 'Сегодня';
      if (dateStr === yesterdayStr) return 'Вчера';
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    };
    
    if (shortTimeframes.includes(timeframe)) {
      // Для коротких таймфреймов показываем день и время с секундами
      const dayLabel = getDayLabel(date);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${dayLabel} ${hours}:${minutes}:${seconds}`;
    } else if (timeframe === '1h' || timeframe === '2h') {
      // Для часовых таймфреймов показываем дату и время
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}.${month} ${hours}:${minutes}`;
    } else if (timeframe === '4h' || timeframe === '6h' || timeframe === '8h' || timeframe === '12h') {
      // Для 4-12 часов показываем дату и время
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      return `${day}.${month} ${hours}:00`;
    } else if (timeframe === '1d' || timeframe === '3d') {
      // Для дневных таймфреймов показываем дату
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } else if (timeframe === '1w') {
      // Для недельных показываем дату начала недели
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } else if (timeframe === '1M') {
      // Для месячных показываем месяц и год
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}.${year}`;
    }
    
    // По умолчанию
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Подключение к WebSocket (как на Binance: история через REST, обновления через WS)
  function connectWebSocket(symbol, timeframe = '1h') {
    // Сохраняем символ и таймфрейм для переподключения
    currentSymbol = symbol;
    currentTimeframe = timeframe;
    
    // Преобразуем BTC/USDT в btcusdt
    const wsSymbol = symbol.replace('/', '').toLowerCase();
    
    // Очищаем старые данные
    priceHistory = [];
    timeHistory = [];
    
    // Правильно закрываем старое подключение
    if (wsConnection) {
      wsManuallyStopped = true;
      
      // Убираем все обработчики перед закрытием
      wsConnection.onopen = null;
      wsConnection.onclose = null;
      wsConnection.onerror = null;
      wsConnection.onmessage = null;
      
      // Закрываем соединение только если оно открыто или подключается
      if (wsConnection.readyState === WebSocket.OPEN || wsConnection.readyState === WebSocket.CONNECTING) {
        try {
          wsConnection.close(1000, 'Switching symbol');
        } catch (e) {
          console.warn('Ошибка при закрытии WebSocket:', e);
        }
      }
      
      wsConnection = null;
    }
    
    // Очищаем таймер переподключения
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    
    // Убеждаемся, что график инициализирован
    if (!realtimeChart) {
      const ctx = document.getElementById('realtimeChart');
      if (ctx) {
        initRealtimeChart();
      }
    }
    
    // Определяем количество свечей для загрузки в зависимости от таймфрейма
    // Для коротких таймфреймов ограничиваем ~1-2 днями (как на Binance)
    let limit = 500; // По умолчанию
    if (timeframe === '1M') limit = 100;
    else if (timeframe === '1w') limit = 200;
    else if (timeframe === '1d' || timeframe === '3d') limit = 300;
    else if (timeframe === '12h' || timeframe === '8h' || timeframe === '6h' || timeframe === '4h') limit = 400;
    else if (timeframe === '2h' || timeframe === '1h') limit = 500;
    else if (timeframe === '30m') limit = 96; // ~2 дня (30мин * 96 = 2 дня)
    else if (timeframe === '15m') limit = 192; // ~2 дня (15мин * 192 = 2 дня)
    else if (timeframe === '5m') limit = 288; // ~1 день (5мин * 288 = 24 часа)
    else if (timeframe === '3m') limit = 480; // ~1 день (3мин * 480 = 24 часа)
    else if (timeframe === '1m') limit = 1440; // ~1 день (1мин * 1440 = 24 часа)
    
    // ШАГ 1: Загружаем исторические данные через наш backend (избегаем CORS)
    fetch(`/api/klines?symbol=${wsSymbol.toUpperCase()}&interval=${timeframe}&limit=${limit}`)
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
        
        // Добавляем исторические данные
        klines.forEach(kline => {
          const timestamp = new Date(kline[0]);
          const closePrice = parseFloat(kline[4]); // Цена закрытия
          const timeStr = formatTime(timestamp, timeframe);
          
          priceHistory.push(closePrice);
          timeHistory.push(timeStr);
        });
        
        // Обновляем график с историей
        if (realtimeChart) {
          realtimeChart.data.labels = [...timeHistory];
          realtimeChart.data.datasets[0].data = [...priceHistory];
          realtimeChart.update('none');
        }
        
        // Обновляем текущую цену
        if (priceHistory.length > 0) {
          const lastPriceValue = priceHistory[priceHistory.length - 1];
          updatePriceInfo(lastPriceValue);
          lastPrice = lastPriceValue;
        }
        
        console.log(`✅ Загружено ${klines.length} исторических свечей для ${symbol} (${timeframe})`);
        showToast('📡 Real-Time котировки подключены', 'success');
        
        // ШАГ 2: Подключаемся к WebSocket только для обновления последней свечи в реальном времени
        // Делаем паузу перед подключением, чтобы старое соединение точно закрылось
        setTimeout(() => {
          // Проверяем, что не было ручной остановки
          if (wsManuallyStopped) {
            return;
          }
          
          const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`;
          wsManuallyStopped = false;
          
          try {
            wsConnection = new WebSocket(wsUrl);
          
          wsConnection.onopen = () => {
            console.log('✅ WebSocket подключен для обновлений', symbol, 'таймфрейм:', timeframe);
          };
          
          wsConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.k) {
              const kline = data.k;
              const price = parseFloat(kline.c); // Текущая цена закрытия свечи
              const timestamp = new Date(kline.t);
              const timeStr = formatTime(timestamp, timeframe);
              
              // Находим индекс последней свечи в истории
              const lastTimeIndex = timeHistory.length - 1;
              const lastTimeStr = lastTimeIndex >= 0 ? timeHistory[lastTimeIndex] : null;
              
              // Если это та же свеча - обновляем, иначе добавляем новую
              if (lastTimeStr === timeStr && lastTimeIndex >= 0) {
                // Обновляем последнюю точку
                priceHistory[lastTimeIndex] = price;
                timeHistory[lastTimeIndex] = timeStr;
              } else {
                // Добавляем новую точку (новая свеча закрылась)
                priceHistory.push(price);
                timeHistory.push(timeStr);
                
                // Ограничиваем количество точек (удаляем старые)
                if (priceHistory.length > limit) {
                  priceHistory.shift();
                  timeHistory.shift();
                }
              }
              
              // Обновляем график
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
              
              // Обновляем информацию о цене
              updatePriceInfo(price);
              
              // Обновляем трейлинг-стоп в реальном времени
              if (trailingStopState.enabled) {
                updateTrailingStop(price);
              }
              
              lastPrice = price;
              
              // Проверяем TP/SL если есть анализ
              if (currentAnalysis) {
                checkSignalLevels(price);
              }
            }
          };
          
          wsConnection.onerror = (error) => {
            if (!wsManuallyStopped) {
              console.error('WebSocket ошибка:', error);
            }
          };
          
          wsConnection.onclose = (event) => {
            // Игнорируем события закрытия если соединение было закрыто вручную
            if (wsManuallyStopped) {
              return;
            }
            
            console.log('WebSocket закрыт', event.code, event.reason);
            
            // Переподключаемся только если не было ручной остановки и код не 1000 (нормальное закрытие)
            if (event.code !== 1000 && currentSymbol && !wsManuallyStopped) {
              // Очищаем предыдущий таймер если есть
              if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
              }
              
              wsReconnectTimer = setTimeout(() => {
                if (!wsManuallyStopped && currentSymbol) {
                  console.log('🔄 Переподключение к WebSocket...');
                  connectWebSocket(currentSymbol, currentTimeframe);
                }
              }, 3000);
            }
          };
          } catch (e) {
            console.error('Ошибка создания WebSocket:', e);
            showToast('⚠️ Ошибка подключения к WebSocket', 'error');
          }
        }, 500); // Увеличена задержка до 500мс для корректного закрытия старого соединения
      })
      .catch(err => {
        console.error('Ошибка загрузки исторических данных:', err);
        const errorMsg = err.message || 'Ошибка загрузки данных';
        
        // Показываем понятное сообщение пользователю
        if (errorMsg.includes('не найдена на бирже')) {
          showToast(`⚠️ ${errorMsg}\nВозможно, данная пара не торгуется на Binance.`, 'error', 8000);
        } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
          showToast('⚠️ Ошибка подключения к серверу. Проверьте интернет-соединение.', 'error', 5000);
        } else {
          showToast(`⚠️ Ошибка загрузки данных: ${errorMsg}`, 'error', 5000);
        }
        
        // Скрываем индикатор загрузки, если есть
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.classList.add('hidden');
      });
  }

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
  function updatePriceInfo(price) {
    const priceEl = document.getElementById('currentPrice');
    if (!priceEl) return;
    
    if (lastPrice === null) {
      lastPrice = price;
      priceEl.textContent = `$${price.toFixed(2)}`;
      priceEl.dataset.prevPrice = price;
      return;
    }
    
    const change = price - lastPrice;
    const changePercent = lastPrice !== 0 ? (change / lastPrice) * 100 : 0;
    
    priceEl.textContent = `$${price.toFixed(2)}`;
    priceEl.dataset.prevPrice = price;
    
    const changeEl = document.getElementById('priceChange');
    if (changeEl) {
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
      changeEl.style.color = change >= 0 ? '#34D399' : '#EF4444';
    }
    
    lastPrice = price;
  }

  // Отображение точек входа/выхода
  function displaySignalLevels(analysis) {
    if (!analysis || !realtimeChart) return;
    
    currentAnalysis = analysis;
    
    // Удаляем старые линии, если есть (оставляем только график цены)
    if (realtimeChart.data.datasets.length > 1) {
      realtimeChart.data.datasets = [realtimeChart.data.datasets[0]];
    }
    
    // Создаем данные для линий (используем текущие labels или создаем один элемент)
    const labelsCount = realtimeChart.data.labels.length || 1;
    const lineData = Array(labelsCount).fill(null);
    
    // Добавляем линии на график как отдельные datasets
    const entryLine = {
      label: 'Entry',
      data: lineData.map(() => analysis.entry_price),
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
      label: analysis.enable_trailing ? 'Trailing Stop Loss' : 'Stop Loss',
      data: lineData.map(() => analysis.stop_loss),
      borderColor: analysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      backgroundColor: analysis.enable_trailing ? 'rgba(255, 152, 0, 0.8)' : 'rgba(239, 68, 68, 0.8)',
      borderWidth: analysis.enable_trailing ? 3 : 2,
      borderDash: analysis.enable_trailing ? [10, 4] : [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: analysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      pointBorderColor: analysis.enable_trailing ? '#ff9800' : 'rgb(239, 68, 68)',
      fill: false,
      spanGaps: true
    };
    
    const takeProfitLine = {
      label: 'Take Profit',
      data: lineData.map(() => analysis.take_profit),
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
    if (analysis.enable_trailing && analysis.trailing_percent) {
      initTrailingStop(analysis, analysis.trailing_percent);
    } else {
      trailingStopState.enabled = false;
    }
    
    realtimeChart.update();
  }

  // === Динамический трейлинг-стоп в реальном времени ===
  let trailingStopState = {
    enabled: false,
    entry: null,
    baseSl: null,
    trailingPercent: 0.5,
    direction: null, // 'long' or 'short'
    currentPrice: null,
    bestPrice: null, // Лучшая цена для расчета трейлинга
    currentSl: null
  };

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

  // Проверка достижения TP/SL
  function checkSignalLevels(currentPrice) {
    if (!currentAnalysis) return;
    
    const { entry_price, stop_loss, take_profit, direction } = currentAnalysis;
    
    let triggered = false;
    let message = '';
    let isProfit = false;
    
    if (direction === 'long') {
      if (currentPrice >= take_profit) {
        triggered = true;
        isProfit = true;
        message = `✅ Take Profit достигнут! Цена: $${currentPrice.toFixed(2)}`;
      } else if (currentPrice <= stop_loss) {
        triggered = true;
        isProfit = false;
        message = `❌ Stop Loss сработал! Цена: $${currentPrice.toFixed(2)}`;
      }
    } else { // short
      if (currentPrice <= take_profit) {
        triggered = true;
        isProfit = true;
        message = `✅ Take Profit достигнут! Цена: $${currentPrice.toFixed(2)}`;
      } else if (currentPrice >= stop_loss) {
        triggered = true;
        isProfit = false;
        message = `❌ Stop Loss сработал! Цена: $${currentPrice.toFixed(2)}`;
      }
    }
    
    if (triggered) {
      showToast(message, isProfit ? 'success' : 'error', 10000);
      
      // Подсвечиваем линию на графике
      highlightSignalLine(isProfit ? 'tp' : 'sl');
      
      // Останавливаем WebSocket после срабатывания
      stopWebSocket();
    }
  }

  // Подсветка линии сигнала
  function highlightSignalLine(type) {
    if (!realtimeChart || !currentAnalysis) return;
    
    // Находим индекс dataset: 1 = Entry, 2 = Stop Loss, 3 = Take Profit
    const datasetIndex = type === 'tp' ? 3 : 2;
    if (realtimeChart.data.datasets[datasetIndex]) {
      realtimeChart.data.datasets[datasetIndex].borderColor = 'rgb(255, 215, 0)'; // Золотой
      realtimeChart.data.datasets[datasetIndex].borderWidth = 4;
      realtimeChart.update();
    }
  }

  // Остановка WebSocket
  function stopWebSocket() {
    // Очищаем таймер скрытия линий
    if (linesHideTimer) {
      clearTimeout(linesHideTimer);
      linesHideTimer = null;
    }
    
    wsManuallyStopped = true; // Устанавливаем флаг ручной остановки
    currentSymbol = null; // Очищаем символ
    
    // Очищаем таймер переподключения
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    
    priceHistory = [];
    timeHistory = [];
    currentAnalysis = null;
    lastPrice = null;
    currentTimeframe = null; // Очищаем таймфрейм
    
    // НЕ скрываем контейнер - график должен быть всегда виден
    // Пользователь может остановить только WebSocket, но график остается
    
    showToast('⏹ Real-Time котировки остановлены', 'info');
  }

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

    // Подключаемся к WebSocket для выбранной пары по умолчанию
    const symbolSelect = document.getElementById('symbol');
    const chartTimeframeSelect = document.getElementById('chartTimeframe');
    
    // ИСПРАВЛЕНО: Инициализируем график при загрузке страницы
    // Подключаемся независимо от состояния wsConnection (может быть null при первой загрузке)
    if (symbolSelect && chartTimeframeSelect) {
      const initialSymbol = symbolSelect.value;
      const initialChartTimeframe = chartTimeframeSelect.value || '1h';
      
      // Инициализируем график, если еще не инициализирован
      if (!realtimeChart) {
        const ctx = document.getElementById('realtimeChart');
        if (ctx) {
          initRealtimeChart();
        }
      }
      
      // ИСПРАВЛЕНО: Подключаемся всегда при загрузке, если график пустой или нет подключения
      // Не ждем проверки priceHistory.length, так как подключение должно произойти сразу
      if (!wsConnection || wsConnection.readyState === WebSocket.CLOSED || wsConnection.readyState === WebSocket.CLOSING) {
        // Всегда подключаемся при первой загрузке (график должен быть заполнен)
        connectWebSocket(initialSymbol, initialChartTimeframe);
      } else if (priceHistory.length === 0) {
        // Если подключение есть, но график пустой - переподключаемся
        wsManuallyStopped = false;
        connectWebSocket(initialSymbol, initialChartTimeframe);
      }
      
      // Обработчик изменения выбранной пары
      symbolSelect.addEventListener('change', () => {
        const newSymbol = symbolSelect.value;
        const chartTf = chartTimeframeSelect.value || '1h';
        
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
          realtimeChart.update('none');
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
        showToast("⚠️ Неверное значение капитала. Используйте положительное число.", "error");
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
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            enable_trailing: false
          })
        });
        
        const data = await res.json();
        
        if (res.ok && data.report_text) {
          displayBeginnerResult(data, symbol, capital);
        } else {
          alert('Ошибка: ' + (data.error || 'Не удалось выполнить анализ'));
        }
      } catch (err) {
        console.error('Ошибка:', err);
        alert('Ошибка соединения с сервером');
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
          ${reliability > 0 ? `<div style="color: #9aa6bf; font-size: 14px; margin-top: 5px;">Надежность: ${reliability}%</div>` : ''}
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
          💡 Это упрощенный анализ. Для детальной информации переключитесь в расширенный режим.
        </div>
      `;
      beginnerResult.style.display = 'block';
    }
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

  window.backtestChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Капитал',
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
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `Капитал: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          },
          title: {
            display: true,
            text: 'Капитал ($)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Период'
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

  // Цвета для каждой стратегии
  const strategyColors = {
    'Консервативная': 'rgb(34, 211, 153)',  // Зеленый
    'Сбалансированная': 'rgb(63, 169, 245)', // Синий
    'Агрессивная': 'rgb(239, 68, 68)'      // Красный
  };

  // Подготовка данных для графика
  const datasets = [];
  const maxLength = Math.max(...Object.values(allStrategiesData).map(s => s.equity_curve ? s.equity_curve.length : 0));
  const labels = Array.from({ length: maxLength }, (_, i) => i + 1);

  for (const [strategyName, data] of Object.entries(allStrategiesData)) {
    if (data.equity_curve && data.equity_curve.length > 0) {
      datasets.push({
        label: strategyName,
        data: data.equity_curve,
        borderColor: strategyColors[strategyName] || 'rgb(128, 128, 128)',
        backgroundColor: (strategyColors[strategyName] || 'rgb(128, 128, 128)').replace('rgb', 'rgba').replace(')', ', 0.1)'),
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
  window.compareBacktestChartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
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
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          },
          title: {
            display: true,
            text: 'Капитал ($)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Период'
          }
        }
      }
    }
  });

  // Создаем сравнительную таблицу
  let tableHTML = '<table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: #2a2d3a; border-radius: 8px; overflow: hidden;">';
  tableHTML += '<thead><tr style="background: #3a3f52; color: #fff;">';
  tableHTML += '<th style="padding: 12px; text-align: left; border-bottom: 2px solid #3fa9f5;">Стратегия</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Win Rate</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Прибыль (%)</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Сделок</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Просадка (%)</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Средний R:R</th>';
  tableHTML += '<th style="padding: 12px; text-align: right; border-bottom: 2px solid #3fa9f5;">Финальный капитал</th>';
  tableHTML += '</tr></thead><tbody>';

  // Сортируем стратегии по прибыли (от лучшей к худшей)
  const sortedStrategies = Object.entries(allStrategiesData).sort((a, b) => 
    (b[1].total_profit_pct || 0) - (a[1].total_profit_pct || 0)
  );

  // Маппинг кодов стратегий в читаемые имена
  // ИСПРАВЛЕНО: Добавлена функция для нормализации названий стратегий
  const normalizeStrategyName = (name) => {
    if (!name) return name;
    const nameLower = name.toLowerCase().trim();
    
    // Английские названия
    if (nameLower.includes('conservative') || nameLower === 'conservative') return 'Консервативная';
    if (nameLower.includes('balanced') || nameLower === 'balanced') return 'Сбалансированная';
    if (nameLower.includes('aggressive') || nameLower === 'aggressive') return 'Агрессивная';
    
    // Русские названия (уже правильные)
    if (name === 'Консервативная') return 'Консервативная';
    if (name === 'Сбалансированная') return 'Сбалансированная';
    if (name === 'Агрессивная') return 'Агрессивная';
    
    // Fallback: возвращаем как есть, но пробуем найти частичное совпадение
    if (name.includes('Консерватив')) return 'Консервативная';
    if (name.includes('Сбалансирован')) return 'Сбалансированная';
    if (name.includes('Агрессив')) return 'Агрессивная';
    
    return name; // Если не нашли - возвращаем как есть
  };

  sortedStrategies.forEach(([strategyName, data], index) => {
    const displayName = normalizeStrategyName(strategyName);
    const rowColor = index % 2 === 0 ? '#2a2d3a' : '#323544';
    const profitColor = data.total_profit_pct >= 0 ? '#22d399' : '#ef4444';
    const winRateColor = data.win_rate >= 50 ? '#22d399' : data.win_rate >= 40 ? '#f59e0b' : '#ef4444';
    
    tableHTML += `<tr style="background: ${rowColor}; color: #e8e8e8;">`;
    tableHTML += `<td style="padding: 12px; font-weight: bold; color: ${strategyColors[displayName] || '#fff'};">${displayName}</td>`;
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
