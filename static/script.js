document.addEventListener("DOMContentLoaded", () => {
  const tradingType = document.getElementById("trading_type");
  const tfInfo = document.getElementById("tfInfo");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const progress = document.getElementById("progressBar");
  const progressBar = progress ? progress.querySelector(".bar") : null;
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

  // --- прогресс без анимации ---
  function startProgress() {
    progress.classList.remove("hidden");
    if (progressBar) progressBar.style.width = "100%";
  }

  function stopProgress() {
    if (progressBar) progressBar.style.width = "0%";
    progress.classList.add("hidden");
  }

  // --- запуск анализа ---
  analyzeBtn.addEventListener("click", async () => {
    const symbol = document.getElementById("symbol").value;
    const strategy = document.getElementById("strategy").value;
    const trading_type = tradingType.value;
    const capital = document.getElementById("capital").value;
    const risk = document.getElementById("risk").value;
    const confirmationSelect = document.getElementById("confirmation");
    const confirmation = confirmationSelect.value;

    console.log("Выбрано подтверждение:", confirmation);

    if (!confirmation) {
      showToast("⚠️ Выберите подтверждение входа", "error");
      return;
    }

    startProgress();
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
		  // --- отображаем график, если сервер его прислал ---
	  const chartContainer = document.getElementById("chartContainer");
	  const chartImage = document.getElementById("chartImage");

	  if (data.chart_base64) {
		chartContainer.classList.remove("hidden");
		chartImage.src = "data:image/png;base64," + data.chart_base64;
	  } else {
		chartContainer.classList.add("hidden");
	  }


        if (data.zip_base64) {
          downloadBtn.classList.remove("disabled");
          downloadBtn.onclick = async (e) => {
            e.preventDefault();

            if (window.pyjs && typeof window.pyjs.saveZipFile === "function") {
              try {
                const cleanSymbol = symbol.replace("/", "_");
				const result = await window.pyjs.saveZipFile(data.zip_base64, `${cleanSymbol}_report.zip`);
				if (result === true || result === "ok") {
				  showToast("💾 Файл успешно сохранён", "success");
				} else {
				  showToast("⚠️ Сохранение отменено", "info");
				}
				return;

                return;
              } catch (err) {
                console.warn("Ошибка передачи файла в PyQt:", err);
              }
            }

            // fallback для браузера
            try {
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
        }
      } else {
        showToast("⚠️ Не удалось получить отчёт", "error");
      }
    } catch (err) {
      stopProgress();
      showToast("❌ Ошибка анализа: " + err.message, "error");
    }
  });

  function base64ToBlob(base64, type = "application/octet-stream") {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
});
