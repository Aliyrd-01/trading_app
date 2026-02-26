# -*- mode: python ; coding: utf-8 -*-

import os
import sys

# Delegate to crypto-analyzer/desktop_app.spec to avoid building from root
_base_dir = os.path.dirname(os.path.abspath(__file__))
_target_spec = os.path.join(_base_dir, "crypto-analyzer", "desktop_app.spec")
if os.path.exists(_target_spec):
    sys.argv = ["pyinstaller"] + [arg for arg in sys.argv if arg not in ("desktop_app.spec", _target_spec)] + [_target_spec]
    exec(open(_target_spec, "r", encoding="utf-8").read())
    raise SystemExit(0)


a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[('templates', 'templates'), ('static', 'static')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='desktop_app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
