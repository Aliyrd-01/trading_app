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
    new QWebChannel(qt.webChannelTransport, function(channel) {
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
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
  }

  // --- запуск анализа ---
  analyzeBtn.addEventListener("click", async () => {
    const symbol = document.getElementById("symbol").value;
    const strategy = document.getElementById("strategy").value;
    const trading_type = tradingType.value;
    const capital = document.getElementById("capital").value;
    const risk = document.getElementById("risk").value;
    const confirmation = document.getElementById("confirmation").value;

    progress.classList.remove("hidden");
    progress.classList.add("active");
    result.classList.add("demo");
    document.querySelector("#result h2").textContent = "📄 Отчёт";
    downloadBtn.classList.add("disabled");

    try {
      const res = await fetch("/run_analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy, trading_type, capital, risk, confirmation })
      });

      const data = await res.json();

      progress.classList.add("hidden");
      progress.classList.remove("active");

      if (data.report_text) {
        reportText.textContent = data.report_text;
        result.classList.remove("demo");
        reportText.style.maxHeight = "none";
        reportText.style.overflow = "visible";
        reportText.style.height = "auto";

        // --- контейнер графика и кнопки ---
        let chartContainer = document.getElementById("chartContainer");
        if (!chartContainer) {
          chartContainer = document.createElement("div");
          chartContainer.id = "chartContainer";
          chartContainer.style.display = "flex";
          chartContainer.style.flexDirection = "column";
          chartContainer.style.alignItems = "center";
          chartContainer.style.marginTop = "20px";
          reportText.insertAdjacentElement("afterend", chartContainer);
        }

        // --- график ---
        let chartImg = document.getElementById("chartImg");
        if (!chartImg) {
          chartImg = document.createElement("img");
          chartImg.id = "chartImg";
          chartImg.alt = "График";
          chartContainer.appendChild(chartImg);
        }
        chartImg.src = "data:image/png;base64," + data.chart_base64;
        chartImg.style.maxWidth = "100%";

        // --- кнопка скачивания ---
        chartContainer.appendChild(downloadBtn);
        downloadBtn.classList.add("disabled");
        downloadBtn.style.pointerEvents = "none";

        // --- активируем кнопку, если есть ZIP ---
        if (data.zip_base64) {
          if (window.pyjs) {
            window.pyjs.setZipBase64(data.zip_base64, symbol);
            downloadBtn.classList.remove("disabled");
            downloadBtn.style.pointerEvents = "auto";
          } else {
            // если не в десктопе — даём прямую ссылку
            downloadBtn.href = "data:application/zip;base64," + data.zip_base64;
            downloadBtn.download = symbol.replace("/", "_") + "_report.zip";
            downloadBtn.classList.remove("disabled");
            downloadBtn.style.pointerEvents = "auto";
          }
        }

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

  // --- клик по кнопке скачивания ---
  downloadBtn.addEventListener("click", (e) => {
    if (downloadBtn.classList.contains("disabled")) {
      e.preventDefault();
      return;
    }

    if (window.pyjs) {
      window.pyjs.downloadReport();
    } else {
      showToast("⚠️ Скачать отчёт можно только в десктопном приложении", "error");
    }
  });
});
