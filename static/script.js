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
  const logoutBtn = document.getElementById("logoutBtn");

  // --- Logout ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("/session_set", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ user_id: null, email: null })
        });
        window.location.href = "/login";
      } catch (err) {
        console.error("Ошибка logout:", err);
      }
    });
  }

  const timeframes = {
    "Скальпинг": "5m",
    "Дейтрейдинг": "1h",
    "Свинг": "4h",
    "Среднесрочная": "1d",
    "Долгосрочная": "1w"
  };

  // --- QWebChannel для PyQt ---
  if (typeof QWebChannel !== "undefined") {
    new QWebChannel(qt.webChannelTransport, function (channel) {
      window.pyjs = channel.objects.pyjs;
      console.log("✅ WebChannel подключен");
    });
  } else {
    console.warn("⚠️ QWebChannel не найден — возможно, запущено в браузере");
  }

  // --- смена таймфрейма ---
  tradingType.addEventListener("change", () => {
    tfInfo.textContent = "Таймфрейм: " + (timeframes[tradingType.value] || "1h");
  });

  // --- всплывающие уведомления ---
  function showToast(text, type = "success") {
    const container = document.getElementById("toastContainer");
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = text;
    container.appendChild(t);
    setTimeout(() => t.classList.add("show"), 100);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  // --- прогресс ---
  function startProgress() {
    progress.classList.remove("hidden");
    if (progressBar) progressBar.style.width = "100%";
  }

  function stopProgress() {
    if (progressBar) progressBar.style.width = "0%";
    progress.classList.add("hidden");
  }

  // --- конвертация base64 в Blob ---
  function base64ToBlob(base64, type = "application/octet-stream") {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  // --- запуск анализа ---
  analyzeBtn.addEventListener("click", async () => {
    const symbol = document.getElementById("symbol").value;
    const strategy = document.getElementById("strategy").value;
    const trading_type = tradingType.value;
    const capital = document.getElementById("capital").value;
    const risk = document.getElementById("risk").value;
    const confirmation = document.getElementById("confirmation").value;

    if (!confirmation) {
      showToast("⚠️ Выберите подтверждение входа", "error");
      return;
    }

    startProgress();
    document.querySelector("#result h2").textContent = "📄 Отчёт";
    downloadBtn.disabled = true;
    downloadStatsBtn.disabled = true;

    try {
      await new Promise(r => setTimeout(r, 50));

      const res = await fetch("/run_analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy, trading_type, capital, risk, confirmation })
      });

      const data = await res.json();
      stopProgress();

      if (data.error) {
        showToast("❌ " + data.error, "error");
        return;
      }

      if (data.ReportV2_text) {
        reportText.innerHTML = "";
        const pre = document.createElement("pre");
        pre.textContent = data.ReportV2_text;
        pre.style.whiteSpace = "pre-wrap";
        reportText.appendChild(pre);

        // Убираем блюр после анализа
        result.classList.remove("demo");

        showToast("✅ Анализ завершён", "success");

        // график
        const chartContainer = document.getElementById("chartContainer");
        const chartImage = document.getElementById("chartImage");
        if (data.chart_base64) {
          chartContainer.classList.remove("hidden");
          chartImage.src = "data:image/png;base64," + data.chart_base64;
        } else {
          chartContainer.classList.add("hidden");
        }

        // включаем кнопки скачивания
        downloadBtn.disabled = false;
        downloadStatsBtn.disabled = false;

        // --- обработчик ZIP отчёта ---
        downloadBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
              const cleanSymbol = symbol.replace("/", "_");
              const ok = await window.pyjs.saveZipFile(data.zip_base64, `${cleanSymbol}_report.zip`);
              if (ok === true || ok === "ok") showToast("💾 Файл успешно сохранён", "success");
              else showToast("⚠️ Сохранение отменено", "info");
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
          } catch (e) {
            showToast("⚠️ Не удалось сохранить файл", "error");
            console.error("ZIP decode error:", e);
          }
        };
      } else {
        showToast("⚠️ Не удалось получить отчёт", "error");
      }
    } catch (err) {
      stopProgress();
      showToast("❌ Ошибка анализа: " + err.message, "error");
    }
  });

  // --- Скачать статистику ---
  downloadStatsBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    downloadStatsBtn.disabled = true;
    try {
      const res = await fetch("/download_user_stats");
      if (!res.ok) {
        showToast("⚠️ Нет данных для отчёта или ошибка при загрузке", "error");
        downloadStatsBtn.disabled = false;
        return;
      }

      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
        const ok = await window.pyjs.saveZipFile(base64, "user_stats.zip");
        if (ok === true || ok === "ok") {
          showToast("💾 Файл статистики успешно сохранён", "success");
        } else {
          showToast("⚠️ Сохранение отменено", "info");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "user_stats.zip";
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
});
