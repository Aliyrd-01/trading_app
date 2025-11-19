// --- Обновление таймфрейма ---
function updateTimeframeInfo() {
  const tfMap = { 
    "Скальпинг": "5m", 
    "Дейтрейдинг": "1h", 
    "Свинг": "4h", 
    "Среднесрочная": "1d", 
    "Долгосрочная": "1w" 
  };
  const val = document.getElementById("trading_type").value;
  document.getElementById("tfInfo").textContent = "Таймфрейм: " + tfMap[val];
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
    "Скальпинг": "5m",
    "Дейтрейдинг": "1h",
    "Свинг": "4h",
    "Среднесрочная": "1d",
    "Долгосрочная": "1w"
  };

  // === Время показа линий анализа по типу торговли ===
  const linesDisplayDuration = {
    "Скальпинг": 5 * 60 * 1000,      // 5 минут
    "Дейтрейдинг": 15 * 60 * 1000,   // 15 минут
    "Свинг": 30 * 60 * 1000,         // 30 минут
    "Среднесрочная": 60 * 60 * 1000, // 1 час
    "Долгосрочная": 2 * 60 * 60 * 1000 // 2 часа
  };

  const timeframeSelect = document.getElementById("timeframe");

  // Обновляем рекомендуемый таймфрейм при изменении типа торговли
  tradingType.addEventListener("change", () => {
    const recommendedTf = timeframes[tradingType.value] || "1h";
    tfInfo.textContent = "Рекомендуемый таймфрейм: " + recommendedTf;
    
    // Если выбран "Автоматически", обновляем текст, но не меняем значение
    if (timeframeSelect && timeframeSelect.value === "auto") {
      // Значение остается "auto", но показываем рекомендацию
    }
  });

  // Обновляем информацию при изменении выбранного таймфрейма
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", () => {
      if (timeframeSelect.value === "auto") {
        const recommendedTf = timeframes[tradingType.value] || "1h";
        tfInfo.textContent = "Рекомендуемый таймфрейм: " + recommendedTf;
      } else {
        tfInfo.textContent = "Выбранный таймфрейм: " + timeframeSelect.value;
      }
    });
  }

  // === Продвинутые настройки: раскрытие/сворачивание ===
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

    toggleAdvanced.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
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
          
          // Показываем понятное сообщение с подсказкой (увеличенное время показа)
          const indicatorNames = data.indicators.join(" + ");
          showToast(`🎯 Автоподбор завершён: ${indicatorNames} (${data.reason}). Теперь нажмите "🚀 Запустить анализ" для получения отчёта.`, "success", 6500);
          
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
          
          // Обрабатываем Markdown жирный текст
          processedText = processedText.replace(/\*\*(.*?)\*\*/g, '___STRONG_START___$1___STRONG_END___');
          
          // Экранируем HTML
          processedText = escapeHtml(processedText);
          
          // Восстанавливаем наши специальные маркеры в HTML
          processedText = processedText.replace(/___DIVIDER_MARKER___/g, '<div class="backtest-divider"></div>');
          processedText = processedText.replace(/___STRONG_START___(.*?)___STRONG_END___/g, '<strong>$1</strong>');
          
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
    const capital = parseFloat(document.getElementById("capital").value);
    const risk = parseFloat(document.getElementById("risk").value);
    const confirmation = document.getElementById("confirmation").value;
    const timeframe = timeframeSelect && timeframeSelect.value !== "auto" ? timeframeSelect.value : null;

    if (!confirmation) {
      showToast("⚠️ Выберите подтверждение входа", "error");
      return;
    }

    startProgress();
    analyzeBtn.disabled = true;
    const originalBtnText = analyzeBtn.textContent;
    analyzeBtn.textContent = "⏳ Анализ рынка...";
    document.querySelector("#result h2").textContent = "📄 Отчёт";
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
        showToast("❌ " + data.error, "error");
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = originalBtnText;
        return;
      }

      if (data.report_text) {
        reportText.innerHTML = renderReport(data.report_text);

        result.classList.remove("demo");
        showToast("✅ Анализ завершён", "success");

        // === Real-Time график ===
        // График уже должен быть виден и работать
        // Просто накладываем линии анализа, если они есть
        if (data.entry_price && data.stop_loss && data.take_profit && data.symbol) {
          // Удаляем старые линии анализа, если есть (оставляем только график цены)
          if (realtimeChart && realtimeChart.data.datasets.length > 1) {
            realtimeChart.data.datasets = [realtimeChart.data.datasets[0]];
            realtimeChart.update();
          }
          
          // Отображаем точки входа/выхода
          displaySignalLevels({
            entry_price: data.entry_price,
            stop_loss: data.stop_loss,
            take_profit: data.take_profit,
            direction: data.direction
          });
          
          // Запускаем таймер автоматического скрытия линий
          scheduleLinesHide(tradingType.value);
          
          showToast('📊 Линии анализа наложены на график', 'success', 3000);
        }

        downloadBtn.disabled = false;
        downloadStatsBtn.disabled = false;
        
        // Восстанавливаем кнопку после успешного анализа
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = originalBtnText;

        // === Скачать ZIP отчёт ===
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
      } else {
        showToast("⚠️ Не удалось получить отчёт", "error");
      }
    } catch (err) {
      stopProgress();
      console.error("Ошибка анализа:", err);
      showToast("❌ Ошибка анализа: " + err.message, "error");
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = originalBtnText;
    }
  });

  // === Скачать статистику ===
  downloadStatsBtn.addEventListener("click", async (e) => {
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
          autoSummaryText.innerHTML = data.auto_summary ? 
            data.auto_summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : 
            "Недостаточно данных для анализа.";
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
              maxTicksLimit: 20 // Показываем максимум 20 меток времени
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
            callbacks: {
              title: function(context) {
                return 'Время: ' + context[0].label;
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
                  color = 'rgb(34, 211, 153)';
                } else if (datasetLabel === 'Stop Loss') {
                  color = 'rgb(239, 68, 68)';
                } else if (datasetLabel === 'Take Profit') {
                  color = 'rgb(59, 130, 246)';
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

  // Функция форматирования времени с миллисекундами
  function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  // Подключение к WebSocket
  function connectWebSocket(symbol, timeframe = '1h') {
    // Сохраняем символ и таймфрейм для переподключения
    currentSymbol = symbol;
    currentTimeframe = timeframe;
    
    // Преобразуем BTC/USDT в btcusdt
    const wsSymbol = symbol.replace('/', '').toLowerCase();
    
    // Определяем, какой stream использовать
    // Для коротких таймфреймов (до 1h) используем ticker для частых обновлений
    // Для длинных таймфреймов используем kline stream
    const shortTimeframes = ['1m', '3m', '5m', '15m', '30m'];
    let wsUrl;
    
    if (shortTimeframes.includes(timeframe)) {
      // Используем ticker для коротких таймфреймов (частые обновления)
      wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
    } else {
      // Используем kline stream для длинных таймфреймов
      wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`;
    }
    
    // Останавливаем старое подключение, если есть
    if (wsConnection) {
      wsManuallyStopped = true; // Временно устанавливаем флаг, чтобы не переподключаться
      wsConnection.close();
      wsConnection = null;
    }
    
    // Сбрасываем флаг ручной остановки
    wsManuallyStopped = false;
    
    // Очищаем таймер переподключения, если есть
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('✅ WebSocket подключен для', symbol, 'таймфрейм:', timeframe);
      showToast('📡 Real-Time котировки подключены', 'success');
      
      // Убеждаемся, что график инициализирован
      if (!realtimeChart) {
        const ctx = document.getElementById('realtimeChart');
        if (ctx) {
          initRealtimeChart();
        }
      }
      
      // Синхронизируем данные с графиком
      if (realtimeChart) {
        if (priceHistory.length === 0 && realtimeChart.data.labels.length > 0) {
          realtimeChart.data.labels = [];
          realtimeChart.data.datasets[0].data = [];
          realtimeChart.update('none');
        } else if (priceHistory.length > 0 && realtimeChart.data.labels.length === 0) {
          realtimeChart.data.labels = [...timeHistory];
          realtimeChart.data.datasets[0].data = [...priceHistory];
          realtimeChart.update('none');
        }
      }
      
      // Запрашиваем текущую цену через REST API для начальной точки графика
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${wsSymbol.toUpperCase()}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => {
          const currentPrice = parseFloat(data.price);
          if (!isNaN(currentPrice) && currentPrice > 0) {
            const timeStr = formatTime(new Date());
            // ВСЕГДА добавляем начальную точку, даже если график не пустой
            // Это гарантирует, что график будет виден сразу
            updateRealtimeChart(currentPrice, timeStr);
            updatePriceInfo(currentPrice);
            lastPrice = currentPrice;
            console.log('✅ Начальная цена добавлена:', currentPrice);
          } else {
            console.error('Неверная цена получена:', data);
          }
        })
        .catch(err => {
          console.error('Ошибка получения текущей цены:', err);
          // Повторная попытка через 1 секунду
          setTimeout(() => {
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${wsSymbol.toUpperCase()}`)
              .then(res => res.json())
              .then(data => {
                const currentPrice = parseFloat(data.price);
                if (!isNaN(currentPrice) && currentPrice > 0) {
                  const timeStr = formatTime(new Date());
                  // ВСЕГДА добавляем начальную точку
                  updateRealtimeChart(currentPrice, timeStr);
                  updatePriceInfo(currentPrice);
                  lastPrice = currentPrice;
                  console.log('✅ Начальная цена добавлена (повторная попытка):', currentPrice);
                }
              })
              .catch(err2 => console.error('Повторная ошибка получения цены:', err2));
          }, 1000);
        });
    };
    
    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      let price, timestamp;
      
      // Определяем формат данных в зависимости от типа stream
      if (data.k) {
        // Kline stream (для длинных таймфреймов)
        const kline = data.k;
        // Используем текущую цену свечи (c), а не только при закрытии
        price = parseFloat(kline.c); // Текущая цена свечи
        timestamp = new Date(kline.t);
        
        const timeStr = formatTime(timestamp);
        
        // ВАЖНО: Обновляем график при каждом сообщении, не только при закрытии
        // Это обеспечит отображение данных даже для долгосрочных таймфреймов
        updateRealtimeChart(price, timeStr);
        updatePriceInfo(price);
        
        // Проверяем TP/SL только при закрытии свечи
        if (kline.x && currentAnalysis) {
          checkSignalLevels(price);
        }
      } else {
        // Ticker stream (для коротких таймфреймов)
        price = parseFloat(data.c || data.lastPrice || data.price);
        if (!price || isNaN(price)) return;
        
        timestamp = new Date();
        const timeStr = formatTime(timestamp);
        
        // Добавляем данные для визуализации
        updateRealtimeChart(price, timeStr);
        updatePriceInfo(price);
        
        // Проверяем TP/SL если есть анализ
        if (currentAnalysis) {
          checkSignalLevels(price);
        }
      }
    };
    
    wsConnection.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
      showToast('⚠️ Ошибка подключения к котировкам', 'error');
    };
    
    wsConnection.onclose = () => {
      console.log('WebSocket закрыт');
      // Автоматическое переподключение через 3 секунды (только если не остановлено вручную и есть символ)
      if (!wsManuallyStopped && currentSymbol && wsConnection && wsConnection.readyState === WebSocket.CLOSED) {
        wsReconnectTimer = setTimeout(() => {
          if (!wsManuallyStopped && currentSymbol && wsConnection && wsConnection.readyState === WebSocket.CLOSED) {
            console.log('🔄 Переподключение к WebSocket...');
            // При переподключении используем последний использованный таймфрейм или из селекта
            const chartTimeframeSelect = document.getElementById('chartTimeframe');
            const lastTimeframe = currentTimeframe || (chartTimeframeSelect ? chartTimeframeSelect.value : '1h') || '1h';
            connectWebSocket(currentSymbol, lastTimeframe);
          }
        }, 3000);
      }
    };
  }

  // Обновление графика
  function updateRealtimeChart(price, timeStr) {
    if (!realtimeChart) {
      console.warn('График не инициализирован при попытке обновления');
      return;
    }
    
    // Проверяем, что цена валидна
    if (isNaN(price) || price <= 0) {
      console.warn('Невалидная цена для графика:', price);
      return;
    }
    
    // Добавляем новую точку
    priceHistory.push(price);
    timeHistory.push(timeStr);
    
    // Ограничиваем количество точек (последние 100)
    if (priceHistory.length > 100) {
      priceHistory.shift();
      timeHistory.shift();
    }
    
    // Обновляем данные графика - создаем новые массивы для Chart.js
    realtimeChart.data.labels = [...timeHistory];
    realtimeChart.data.datasets[0].data = [...priceHistory];
    
    // Обновляем линии входа/выхода, если они есть (расширяем их на новую длину)
    if (currentAnalysis && realtimeChart.data.datasets.length > 1) {
      for (let i = 1; i < realtimeChart.data.datasets.length; i++) {
        const dataset = realtimeChart.data.datasets[i];
        if (dataset.label === 'Entry' || dataset.label === 'Stop Loss' || dataset.label === 'Take Profit') {
          // Сохраняем значение линии и расширяем массив данных
          const lineValue = dataset.data && dataset.data.length > 0 
            ? (dataset.data[0] || dataset.data[dataset.data.length - 1])
            : null;
          if (lineValue !== null) {
            dataset.data = priceHistory.map(() => lineValue);
          }
        }
      }
    }
    
    // Обновляем график без анимации
    realtimeChart.update('none');
    
    // Логирование для отладки (можно убрать после исправления)
    if (priceHistory.length === 1) {
      console.log('✅ Первая точка добавлена на график:', price, timeStr);
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
      borderColor: 'rgb(34, 211, 153)', // Зеленый
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
    
    const stopLossLine = {
      label: 'Stop Loss',
      data: lineData.map(() => analysis.stop_loss),
      borderColor: 'rgb(239, 68, 68)', // Красный
      backgroundColor: 'rgba(239, 68, 68, 0.8)', // Красный для легенды
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(239, 68, 68)',
      pointBorderColor: 'rgb(239, 68, 68)',
      fill: false,
      spanGaps: true
    };
    
    const takeProfitLine = {
      label: 'Take Profit',
      data: lineData.map(() => analysis.take_profit),
      borderColor: 'rgb(59, 130, 246)', // Синий
      backgroundColor: 'rgba(59, 130, 246, 0.8)', // Синий для легенды
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(59, 130, 246)',
      pointBorderColor: 'rgb(59, 130, 246)',
      fill: false,
      spanGaps: true
    };
    
    // Добавляем новые линии
    realtimeChart.data.datasets.push(entryLine, stopLossLine, takeProfitLine);
    
    realtimeChart.update();
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
    
    // Подключаемся независимо от состояния wsConnection (может быть null при первой загрузке)
    if (symbolSelect && chartTimeframeSelect) {
      const initialSymbol = symbolSelect.value;
      const initialChartTimeframe = chartTimeframeSelect.value || '1h';
      
      // Подключаемся только если еще не подключены
      if (!wsConnection || wsConnection.readyState === WebSocket.CLOSED) {
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
});
