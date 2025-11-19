import sys
import threading
import time
import base64
import requests
import socket

from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QFileDialog
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl, QTimer

# импорт твоего backend Flask
from app import app  # Flask backend

# Глобальная переменная для порта
FLASK_PORT = None

def find_free_port(start_port=8000, max_attempts=100):
    """Находит свободный порт, начиная с start_port"""
    for i in range(max_attempts):
        port = start_port + i
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            result = sock.connect_ex(('127.0.0.1', port))
            sock.close()
            if result != 0:  # Порт свободен (не удалось подключиться)
                # Дополнительная проверка через bind
                test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                test_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    test_sock.bind(('127.0.0.1', port))
                    test_sock.close()
                    return port
                except OSError:
                    test_sock.close()
                    continue
        except Exception:
            sock.close()
            continue
    return None


# --- WebBridge для взаимодействия с JS (сохранение ZIP, уведомление о login) ---
class WebBridge(QObject):
    @pyqtSlot(str, str, result=str)
    def saveZipFile(self, zip_base64, suggested_name):
        try:
            path, _ = QFileDialog.getSaveFileName(
                None, "Сохранить отчёт", suggested_name, "ZIP Files (*.zip)"
            )
            if not path:
                return "cancel"
            data = base64.b64decode(zip_base64)
            with open(path, "wb") as f:
                f.write(data)
            return "ok"
        except Exception as e:
            print("Ошибка при сохранении ZIP:", e)
            return "cancel"

    @pyqtSlot(str, str, result=str)
    def savePdfFile(self, pdf_base64, suggested_name):
        try:
            path, _ = QFileDialog.getSaveFileName(
                None, "Сохранить PDF", suggested_name, "PDF Files (*.pdf)"
            )
            if not path:
                return "cancel"
            data = base64.b64decode(pdf_base64)
            with open(path, "wb") as f:
                f.write(data)
            return "ok"
        except Exception as e:
            print("Ошибка при сохранении PDF:", e)
            return "cancel"

    @pyqtSlot(str)
    def loginSuccess(self, payload_json):
        # JS сообщает о успешном логине
        print("Login payload from JS:", payload_json)


# --- Функция запуска Flask в отдельном потоке ---
def run_flask():
    global FLASK_PORT
    try:
        app.run(debug=False, host="127.0.0.1", port=FLASK_PORT, use_reloader=False, threaded=True)
    except OSError as e:
        print(f"❌ Ошибка запуска Flask на порту {FLASK_PORT}: {e}")
        print("💡 Попробуйте:")
        print("   1. Закрыть другие приложения, использующие этот порт")
        print("   2. Запустить от имени администратора")
        print("   3. Перезапустить приложение для автоматического выбора другого порта")


def wait_for_server(url=None, timeout=10):
    if url is None:
        url = f"http://127.0.0.1:{FLASK_PORT}"
    for _ in range(timeout * 10):
        try:
            r = requests.get(url, timeout=1.0)
            if r.status_code in (200, 302):
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


# --- Главное окно с QWebEngineView ---
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Crypto Trading Analyzer")
        self.resize(1200, 800)
        self.setMinimumSize(1200, 800)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        central.setLayout(layout)

        # Создаём QWebEngineView для десктопного приложения
        self.web = QWebEngineView()
        # Убеждаемся, что виджет виден и имеет правильный размер
        self.web.setVisible(True)
        self.web.show()
        layout.addWidget(self.web)

        # Настройки WebEngine для десктопного приложения
        settings = self.web.settings()
        # Отключаем WebGL и ускорение для стабильности в десктопном приложении
        settings.setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebGLEnabled, False)
        # Включаем необходимые функции
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.PluginsEnabled, False)  # Отключаем плагины (не нужны)
        # Для десктопного приложения: включаем авто-загрузку изображений
        settings.setAttribute(QWebEngineSettings.AutoLoadImages, True)

        # WebChannel
        self.channel = QWebChannel()
        self.bridge = WebBridge()
        self.channel.registerObject("pyjs", self.bridge)
        self.web.page().setWebChannel(self.channel)

        # Обработка ошибок загрузки
        self.web.page().loadFinished.connect(self._on_page_load)
        self.web.page().loadProgress.connect(self._on_load_progress)
        
        # Обработка JavaScript ошибок
        self.web.page().javaScriptConsoleMessage = self._on_js_console_message

        # Для десктопного приложения: загружаем страницу после небольшой задержки
        # чтобы убедиться, что виджет полностью инициализирован
        url = QUrl(f"http://127.0.0.1:{FLASK_PORT}/login")
        print(f"🌐 Десктопное приложение: загрузка страницы {url.toString()}")
        
        # Загружаем страницу через QTimer для корректной инициализации в десктопном приложении
        QTimer.singleShot(100, lambda: self._load_page(url))
    
    def _load_page(self, url):
        """Загрузка страницы (отдельный метод для десктопного приложения)"""
        print(f"📱 Загрузка URL в десктопном приложении: {url.toString()}")
        self.web.setUrl(url)
        # Принудительно обновляем виджет
        self.web.update()
        QApplication.processEvents()

    def _on_load_progress(self, progress):
        """Отслеживание прогресса загрузки"""
        if progress == 100:
            print("✅ Страница загружена полностью")
        elif progress % 25 == 0:  # Логируем каждые 25%
            print(f"📥 Загрузка: {progress}%")

    def _on_page_load(self, ok):
        """Обработка завершения загрузки страницы в десктопном приложении"""
        if not ok:
            print("❌ Не удалось загрузить страницу в десктопном приложении")
            print(f"   Проверьте, что Flask сервер запущен на http://127.0.0.1:{FLASK_PORT}")
            # Для десктопного приложения: пытаемся перезагрузить через 2 секунды
            QTimer.singleShot(2000, lambda: self.web.reload())
            return
        
        print("✅ Страница успешно загружена в десктопном приложении")
        # Для десктопного приложения: принудительно обновляем отображение
        self.web.setVisible(True)
        self.web.show()
        self.web.update()
        self.web.repaint()
        QApplication.processEvents()
        
    def _on_js_console_message(self, level, message, line_number, source_id):
        """Обработка сообщений JavaScript консоли"""
        # Игнорируем WebGL ошибки (они не критичны)
        if "GL ERROR" in message or "WebGL" in message or "texture" in message.lower():
            return  # Не логируем WebGL ошибки
        
        # Логируем только важные ошибки
        if level == 2:  # Error level
            print(f"⚠️ JS Error: {message} (line {line_number})")
        elif "ERROR" in message.upper() or "Error" in message:
            print(f"⚠️ JS: {message}")


# --- Основной запуск ---
if __name__ == "__main__":
    # Находим свободный порт (начинаем с 8000, так как обычно свободен)
    print("🔍 Поиск свободного порта...")
    FLASK_PORT = find_free_port(8000, 100)
    if FLASK_PORT is None:
        print("❌ Не удалось найти свободный порт. Закройте другие приложения и попробуйте снова.")
        sys.exit(1)
    
    print(f"🔍 Найден свободный порт: {FLASK_PORT}")
    
    # Запуск Flask в отдельном потоке
    threading.Thread(target=run_flask, daemon=True).start()
    print("Запуск Flask-сервера...")
    
    # Ждём, пока сервер точно запустится
    if not wait_for_server():
        print(f"⚠️ Сервер не доступен на http://127.0.0.1:{FLASK_PORT}")
        print("   Приложение может не работать корректно")
    else:
        print(f"✅ Flask сервер запущен на http://127.0.0.1:{FLASK_PORT}")

    # Небольшая задержка для полной инициализации сервера
    time.sleep(0.5)

    app_qt = QApplication(sys.argv)
    app_qt.setStyleSheet("QPushButton { outline: none; } QPushButton:focus { outline: none; }")

    main_window = MainWindow()
    main_window.show()
    
    print("🚀 Приложение запущено. Ожидание загрузки интерфейса...")

    sys.exit(app_qt.exec_())
