import hashlib
import os
import subprocess
import tempfile
import time
from urllib.parse import urljoin, urlparse
import json

import requests

from app_version import APP_VERSION, UPDATE_MANIFEST_URL


def _parse_version(v: str):
    parts = []
    for x in (v or "").strip().split("."):
        try:
            parts.append(int(x))
        except Exception:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _is_newer(latest: str, current: str) -> bool:
    return _parse_version(latest) > _parse_version(current)


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_manifest(timeout_sec: int = 8):
    url = f"{UPDATE_MANIFEST_URL}?t={int(time.time())}"
    r = requests.get(url, timeout=timeout_sec)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        try:
            return json.loads(r.content.decode("utf-8-sig"))
        except Exception:
            return json.loads(r.text)


def _download_file(url: str, target_path: str, timeout_sec: int = 60):
    return _download_file_with_progress(url, target_path, timeout_sec=timeout_sec, progress_cb=None)


def _download_file_with_progress(url: str, target_path: str, timeout_sec: int = 60, progress_cb=None):
    with requests.get(url, stream=True, timeout=timeout_sec) as r:
        r.raise_for_status()
        total = 0
        try:
            total = int(r.headers.get("Content-Length") or 0)
        except Exception:
            total = 0

        downloaded = 0
        if progress_cb:
            try:
                progress_cb(downloaded, total)
            except Exception:
                pass

        with open(target_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_cb:
                        try:
                            progress_cb(downloaded, total)
                        except Exception:
                            pass


def _state_dir() -> str:
    base = os.getenv("LOCALAPPDATA") or tempfile.gettempdir()
    d = os.path.join(base, "CryptoInsightX", "Crypto Trading Analyzer")
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        return tempfile.gettempdir()
    return d


def _state_path() -> str:
    return os.path.join(_state_dir(), "update_state.json")


def _log_path() -> str:
    return os.path.join(_state_dir(), "update_log.txt")


def _log_update(message: str) -> None:
    try:
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(_log_path(), "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {message}\n")
    except Exception:
        pass


def _load_state() -> dict:
    try:
        with open(_state_path(), "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def _save_state(state: dict) -> None:
    try:
        with open(_state_path(), "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception:
        pass


def check_and_prompt_update(ui, timeout_sec: int = 8) -> bool:
    now = int(time.time())
    state = _load_state()
    try:
        _log_update(f"check start current_version={APP_VERSION} manifest_url={UPDATE_MANIFEST_URL}")
    except Exception:
        pass
    if "snooze_until" in state:
        try:
            _log_update("removing legacy snooze_until from state")
        except Exception:
            pass
        del state["snooze_until"]
        _save_state(state)

    error_until = int(state.get("error_until", 0) or 0)
    in_progress_until = int(state.get("in_progress_until", 0) or 0)
    if now < in_progress_until:
        try:
            _log_update(f"suppressed by in_progress_until (now={now} < {in_progress_until})")
        except Exception:
            pass
        return False

    if now < error_until:
        try:
            _log_update(f"suppressed by error_until backoff (now={now} < {error_until})")
        except Exception:
            pass
        return False

    try:
        manifest = fetch_manifest(timeout_sec=timeout_sec)
    except Exception as e:
        try:
            _log_update(f"manifest fetch failed: {type(e).__name__}: {e}")
        except Exception:
            pass
        try:
            state["error_until"] = int(time.time()) + 5 * 60
            _save_state(state)
        except Exception:
            pass
        return False

    if "error_until" in state:
        try:
            state.pop("error_until", None)
            _save_state(state)
            _log_update("cleared error_until backoff after successful manifest parse")
        except Exception:
            pass

    latest_version = str(manifest.get("version", "")).strip()
    installer_url = str(manifest.get("installer_url", manifest.get("url", ""))).strip()
    expected_sha256 = str(manifest.get("sha256", "")).strip().lower()
    release_notes = str(manifest.get("release_notes", "")).strip()

    try:
        _log_update(f"manifest parsed latest_version={latest_version!r} installer_url={installer_url!r} sha256_present={bool(expected_sha256)}")
    except Exception:
        pass

    if not latest_version or not installer_url:
        try:
            _log_update("manifest missing required fields: version and/or installer_url")
        except Exception:
            pass
        return False

    if not installer_url.lower().startswith("http"):
        installer_url = urljoin(UPDATE_MANIFEST_URL, installer_url)

    if not _is_newer(latest_version, APP_VERSION):
        try:
            _log_update(f"no update: latest_version={latest_version} is not newer than current_version={APP_VERSION}")
        except Exception:
            pass
        return False

    text = f"A new version {latest_version} is available (current {APP_VERSION}).\n\nInstall the update now?"
    if release_notes:
        text = text + f"\n\nWhat's new:\n{release_notes}"

    if not ui.question("Update Available", text):
        try:
            _log_update("user declined update prompt")
        except Exception:
            pass
        return False

    try:
        ui.info("Update", "Downloading the update installer. Please wait...")
        tmp_dir = tempfile.mkdtemp(prefix="cryptotradinganalyzer_update_")
        parsed = urlparse(installer_url)
        filename = os.path.basename(parsed.path) or "CryptoTradingAnalyzer-Setup.exe"
        installer_path = os.path.join(tmp_dir, filename)

        try:
            _log_update(f"downloading installer to {installer_path} from {installer_url}")
        except Exception:
            pass

        progress = None
        if hasattr(ui, "progress"):
            try:
                progress = ui.progress("Update", "Downloading installer...", 0)
            except Exception:
                progress = None

        try:
            _download_file_with_progress(
                installer_url,
                installer_path,
                progress_cb=(progress.update if progress else None),
            )
        finally:
            if progress:
                try:
                    progress.close()
                except Exception:
                    pass

        if expected_sha256:
            actual = _sha256_file(installer_path).lower()
            if actual != expected_sha256:
                raise RuntimeError("sha256 mismatch")

        state["in_progress_until"] = int(time.time()) + 30 * 60
        _save_state(state)

        ui.info("Update", "Installer started. The app will now close.\n\nAfter installation, please start the app again.")

        # Inno Setup: https://jrsoftware.org/ishelp/topic_setupcmdline.htm
        # /SILENT показывает прогресс, в отличие от /VERYSILENT.
        subprocess.Popen([installer_path, "/SILENT", "/NORESTART", "/SUPPRESSMSGBOXES"], close_fds=True)

        return True

    except Exception as e:
        try:
            _log_update(f"update failed: {type(e).__name__}: {e}")
        except Exception:
            pass
        state["error_until"] = int(time.time()) + 5 * 60
        _save_state(state)
        ui.error("Update Error", f"Failed to download or launch the update.\n\nDetails: {e}")
        return False
