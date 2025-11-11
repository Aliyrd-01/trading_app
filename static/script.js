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
  const logoutBtn = document.getElementById("logoutBtn");

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

  tradingType.addEventListener("change", () => {
    tfInfo.textContent = "Таймфрейм: " + (timeframes[tradingType.value] || "1h");
  });

  // === Toast уведомления ===
  function showToast(text, type = "success") {
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
    }, 3500);
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

    if (!confirmation) {
      showToast("⚠️ Выберите подтверждение входа", "error");
      return;
    }

    startProgress();
    document.querySelector("#result h2").textContent = "📄 Отчёт";
    downloadBtn.disabled = true;
    downloadStatsBtn.disabled = true;

    try {
      await new Promise(r => setTimeout(r, 100));

      const res = await fetch("/api/analyze", {
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

      if (data.report_text) {
        reportText.innerHTML = "";
        const pre = document.createElement("pre");
        pre.textContent = data.report_text;
        pre.style.whiteSpace = "pre-wrap";
        reportText.appendChild(pre);

        result.classList.remove("demo");
        showToast("✅ Анализ завершён", "success");

        const chartContainer = document.getElementById("chartContainer");
        const chartImage = document.getElementById("chartImage");

        if (data.chart_base64) {
          chartContainer.classList.remove("hidden");
          chartImage.src = "data:image/png;base64," + data.chart_base64;
        } else {
          chartContainer.classList.add("hidden");
        }

        downloadBtn.disabled = false;
        downloadStatsBtn.disabled = false;

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
    }
  });

  // === Скачать статистику ===
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      // Если доступен мост PyQt — сохраняем через системный диалог
      if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result || "").toString().split(",")[1] || "";
            const res2 = await window.pyjs.saveZipFile(base64, "user_stats.zip");
            if (res2 === "ok") {
              showToast("📊 Статистика успешно сохранена", "success");
            } else {
              showToast("⚠️ Сохранение отменено", "error");
            }
          } catch (err) {
            console.error("Ошибка сохранения через мост:", err);
            // Фолбэк: сохранение через браузер
            a.href = url;
            a.download = "user_stats.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("📊 Статистика успешно загружена", "success");
          }
        };
        reader.onerror = () => {
          // Фолбэк: сохранение через браузер
          a.href = url;
          a.download = "user_stats.zip";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast("📊 Статистика успешно загружена", "success");
        };
        reader.readAsDataURL(blob);
      } else {
        // Обычный браузер: скачивание в папку загрузок
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
