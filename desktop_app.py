import sys
import threading
import time
import base64
import requests
import os
import socket
import ctypes
from ctypes import wintypes

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("QT_OPENGL", "angle")
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist --disable-gpu-sandbox --no-sandbox",
)
os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")

from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QFileDialog
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl, Qt, QCoreApplication, QTimer
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings, QWebEngineProfile, QWebEnginePage

# импорт твоего backend Flask
import importlib.util

_app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
_spec = importlib.util.spec_from_file_location("crypto_analyzer_app", _app_path)
_app_module = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
sys.modules["app"] = _app_module
_spec.loader.exec_module(_app_module)
app = _app_module.app  # Flask backend

FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
_preferred_port = int(os.getenv("FLASK_PORT", "5050"))
SERVER_PORT = None


def _pick_available_port(host: str, preferred_port: int) -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((host, preferred_port))
        return preferred_port
    except OSError:
        pass
    finally:
        try:
            s.close()
        except Exception:
            pass

    s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s2.bind((host, 0))
        return int(s2.getsockname()[1])
    finally:
        try:
            s2.close()
        except Exception:
            pass


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
    def saveJsonFile(self, json_content, suggested_name):
        try:
            path, _ = QFileDialog.getSaveFileName(
                None, "Сохранить JSON файл", suggested_name, "JSON Files (*.json)"
            )
            if not path:
                return "cancel"
            with open(path, "w", encoding="utf-8") as f:
                f.write(json_content)
            return "ok"
        except Exception as e:
            print("Ошибка при сохранении JSON:", e)
            return "cancel"

    @pyqtSlot(str)
    def loginSuccess(self, payload_json):
        print("Login payload from JS:", payload_json)


class LoggingWebEnginePage(QWebEnginePage):
    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
        try:
            print(f"[JS console] {sourceID}:{lineNumber} {message}")
        except Exception:
            pass
        super().javaScriptConsoleMessage(level, message, lineNumber, sourceID)


def run_flask():
    try:
        port = SERVER_PORT or _preferred_port
        app.run(debug=False, host=FLASK_HOST, port=port, use_reloader=False, threaded=True)
    except Exception as e:
        print("Flask не запустился:", repr(e))


def wait_for_server(url=None, timeout=20):
    if not url:
        port = SERVER_PORT or _preferred_port
        url = f"http://{FLASK_HOST}:{port}/login"
    for _ in range(timeout * 10):
        try:
            r = requests.get(url, timeout=1.0)
            if r.status_code in (200, 302):
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Crypto Trading Analyzer")
        self.resize(1200, 800)
        self.setMinimumSize(1200, 800)

        self._suspended = False

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        central.setLayout(layout)

        self.web = QWebEngineView()
        layout.addWidget(self.web)

        base_root = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
        base_dir = os.path.join(base_root, "CryptoInsightX", "qt_profile")
        os.makedirs(base_dir, exist_ok=True)

        self.profile = QWebEngineProfile("CryptoInsightX", self.web)
        self.profile.setPersistentStoragePath(base_dir)
        self.profile.setCachePath(base_dir)
        self.profile.setHttpCacheType(QWebEngineProfile.DiskHttpCache)
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.ForcePersistentCookies)

        self.page = LoggingWebEnginePage(self.profile, self.web)
        self.web.setPage(self.page)

        self._load_retry_count = 0
        self._last_requested_url = None

        self.page.loadStarted.connect(lambda: print("[WebEngine] loadStarted", self.page.url().toString()))
        self.page.loadProgress.connect(lambda p: print("[WebEngine] loadProgress", p))
        self.page.loadFinished.connect(self._on_page_load)
        self.page.urlChanged.connect(lambda url: print("[WebEngine] urlChanged", url.toString()))
        try:
            self.page.renderProcessTerminated.connect(self._on_render_terminated)
        except Exception:
            pass

        self.web.settings().setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, False)
        self.web.settings().setAttribute(QWebEngineSettings.WebGLEnabled, False)
        try:
            self.web.settings().setAttribute(QWebEngineSettings.SpellCheckEnabled, False)
        except Exception:
            pass
        try:
            self.profile.setSpellCheckEnabled(False)
        except Exception:
            try:
                QWebEngineProfile.defaultProfile().setSpellCheckEnabled(False)
            except Exception:
                pass

        self.channel = QWebChannel()
        self.bridge = WebBridge()
        self.channel.registerObject("pyjs", self.bridge)
        self.web.page().setWebChannel(self.channel)

        self.web.setUrl(QUrl("about:blank"))
        QTimer.singleShot(250, self._load_login)

    def _recover_webview(self, reason: str = ""):
        try:
            print(f"[WebEngine] recover_webview reason={reason}")
        except Exception:
            pass

        try:
            if getattr(self, 'page', None):
                self.page.triggerAction(QWebEnginePage.Stop)
        except Exception:
            pass

        try:
            if getattr(self, 'web', None):
                self.web.setUrl(QUrl("about:blank"))
        except Exception:
            pass

        QTimer.singleShot(250, self._load_login)

    def nativeEvent(self, eventType, message):
        try:
            if sys.platform.startswith("win") and eventType == "windows_generic_MSG":
                msg = wintypes.MSG.from_address(int(message))
                WM_POWERBROADCAST = 0x0218
                PBT_APMSUSPEND = 0x0004
                PBT_APMRESUMESUSPEND = 0x0007
                PBT_APMRESUMEAUTOMATIC = 0x0012

                if msg.message == WM_POWERBROADCAST:
                    if msg.wParam == PBT_APMSUSPEND:
                        self._suspended = True
                        try:
                            print("[Power] suspend")
                        except Exception:
                            pass
                    elif msg.wParam in (PBT_APMRESUMESUSPEND, PBT_APMRESUMEAUTOMATIC):
                        self._suspended = False
                        try:
                            print("[Power] resume")
                        except Exception:
                            pass
                        QTimer.singleShot(300, lambda: self._recover_webview("resume"))
        except Exception:
            pass

        return super().nativeEvent(eventType, message)

    def closeEvent(self, event):
        try:
            try:
                self.web.setUrl(QUrl("about:blank"))
            except Exception:
                pass

            try:
                if getattr(self, 'page', None):
                    self.page.triggerAction(QWebEnginePage.Stop)
            except Exception:
                pass

            try:
                if getattr(self, 'web', None):
                    self.web.setPage(None)
            except Exception:
                pass

            try:
                if getattr(self, 'page', None):
                    self.page.deleteLater()
            except Exception:
                pass

            try:
                if getattr(self, 'profile', None):
                    self.profile.deleteLater()
            except Exception:
                pass
        finally:
            try:
                super().closeEvent(event)
            except Exception:
                pass

    def _login_url(self):
        port = SERVER_PORT or _preferred_port
        return QUrl(f"http://{FLASK_HOST}:{port}/login?v={int(time.time())}")

    def _load_login(self):
        url = self._login_url()
        self._last_requested_url = url.toString()
        self.web.setUrl(url)

    def _on_page_load(self, ok):
        if not ok:
            print("Не удалось загрузить страницу", self.page.url().toString())
            if self._load_retry_count < 5:
                self._load_retry_count += 1
                delay = min(3000, 600 * self._load_retry_count)
                self.web.setUrl(QUrl("about:blank"))
                QTimer.singleShot(delay, self._load_login)
            return

        self._load_retry_count = 0

    def _on_render_terminated(self, terminationStatus, exitCode):
        print("[WebEngine] renderProcessTerminated", terminationStatus, exitCode)
        QTimer.singleShot(300, lambda: self._recover_webview("render_terminated"))


if __name__ == "__main__":
    QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts, True)

    SERVER_PORT = _pick_available_port(FLASK_HOST, _preferred_port)
    login_url = f"http://{FLASK_HOST}:{SERVER_PORT}/login"
    print(f"Flask будет запущен на {login_url}")

    threading.Thread(target=run_flask, daemon=True).start()
    print("Запуск Flask-сервера...")
    if not wait_for_server(url=login_url):
        print(f"Сервер не доступен на {login_url}")

    app_qt = QApplication(sys.argv)
    app_qt.setStyleSheet("QPushButton { outline: none; } QPushButton:focus { outline: none; }")

    main_window = MainWindow()
    main_window.show()

    sys.exit(app_qt.exec_())
