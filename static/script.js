document.addEventListener("DOMContentLoaded", () => {
  const tradingType = document.getElementById("trading_type");
  const tfInfo = document.getElementById("tfInfo");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const progress = document.getElementById("progressBar");
  const result = document.getElementById("result");
  const reportText = document.getElementById("reportText");
  const downloadBtn = document.getElementById("downloadZip");

  const timeframes = {
    "Скальпинг": "5m",
    "Дейтрейдинг": "1h",
    "Свинг": "4h",
    "Среднесрочная": "1d",
    "Долгосрочная": "1w"
  };

  // --- подключение к PyQt Bridge ---
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

  // --- всплывашка ---
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

  // --- запуск анализа ---
  analyzeBtn.addEventListener("click", async () => {
    const symbol = document.getElementById("symbol").value;
    const strategy = document.getElementById("strategy").value;
    const trading_type = tradingType.value;
    const capital = document.getElementById("capital").value;
    const risk = document.getElementById("risk").value;
    const confirmationSelect = document.getElementById("confirmation");

    // Собираем все выбранные значения
    const confirmation = Array.from(confirmationSelect.selectedOptions).map(o => o.value);
    console.log("Выбрано подтверждений:", confirmation);

    if (confirmation.length === 0) {
      showToast("⚠️ Выберите хотя бы одно подтверждение входа", "error");
      return;
    }

    progress.classList.remove("hidden");
    progress.classList.add("active");
    result.classList.add("demo");
    document.querySelector("#result h2").textContent = "📄 Отчёт";
    downloadBtn.classList.add("disabled");

    try {
      await new Promise(r => setTimeout(r, 50));

      const res = await fetch("/run_analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy, trading_type, capital, risk, confirmation })
      });

      const data = await res.json();

      progress.classList.add("hidden");
      progress.classList.remove("active");

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
      } else {
        showToast("⚠️ Не удалось получить отчёт", "error");
      }
    } catch (err) {
      progress.classList.add("hidden");
      progress.classList.remove("active");
      showToast("❌ Ошибка анализа: " + err.message, "error");
    }
  });
});
