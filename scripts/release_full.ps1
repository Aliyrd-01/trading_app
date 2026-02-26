param(
  [Parameter(Mandatory=$true)]
  [string]$Version,

  [ValidateSet("CryptoTradingAnalyzer","CryptoMonitor")]
  [string]$App = "CryptoTradingAnalyzer",

  [string]$ReleaseNotes = "",

  [string]$BaseUrl = "https://cryptoanalyz.net/downloads",

  [string]$ISCCPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$CryptoAnalyzerDir = Join-Path $RepoRoot "crypto-analyzer"
$CryptoMonitorDir = Join-Path $RepoRoot "CryptoMonitor"
$CryptoMonitorMain = Join-Path $CryptoMonitorDir "CryptoMonitor_new.py"
$CryptoMonitorIssPath = Join-Path $CryptoMonitorDir "CryptoPrice.iss"

$IssPath = Join-Path $RepoRoot "installer\windows\CryptoInsightX.iss"
$ReleaseScript = Join-Path $RepoRoot "scripts\release.ps1"
$OutDir = Join-Path $RepoRoot "release_artifacts"

$RootAppVersionPath = Join-Path $RepoRoot "app_version.py"
$CryptoAppVersionPath = Join-Path $RepoRoot "crypto-analyzer\app_version.py"

$IcoPath = Join-Path $RepoRoot "server-php\public\favicon.ico"
$MakeIcoScript = Join-Path $RepoRoot "scripts\make_favicon_ico.ps1"

$CryptoMonitorIco = $null
$CryptoMonitorIconTmpDir = $null
if ($App -eq "CryptoMonitor") {
  if (-not (Test-Path -LiteralPath $MakeIcoScript)) { throw "make_favicon_ico.ps1 not found: $MakeIcoScript" }
  $CryptoMonitorIconTmpDir = Join-Path $env:TEMP (("cryptomonitor_icon_") + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $CryptoMonitorIconTmpDir -Force | Out-Null
  $CryptoMonitorIco = Join-Path $CryptoMonitorIconTmpDir "app_icon.ico"

  $CryptoMonitorPng = $null
  foreach ($p in @(
    (Join-Path $CryptoMonitorDir "app_icon.png"),
    (Join-Path $CryptoMonitorDir "app_icon1.png"),
    (Join-Path $CryptoMonitorDir "1.png")
  )) {
    if (Test-Path -LiteralPath $p) { $CryptoMonitorPng = $p; break }
  }
  if (-not $CryptoMonitorPng) { throw "CryptoMonitor icon PNG not found (expected app_icon1.png/app_icon.png/1.png)" }

  & powershell -ExecutionPolicy Bypass -File $MakeIcoScript -InputPng $CryptoMonitorPng -OutputIco $CryptoMonitorIco
  if ($LASTEXITCODE -ne 0) { throw "Icon generation failed (exit code $LASTEXITCODE)" }
  if ((-not (Test-Path -LiteralPath $CryptoMonitorIco)) -or ((Get-Item -LiteralPath $CryptoMonitorIco).Length -le 0)) {
    throw "Invalid icon file (empty): $CryptoMonitorIco"
  }
}

if (-not (Test-Path -LiteralPath $ISCCPath)) { throw "ISCC.exe not found: $ISCCPath" }
if (($App -eq "CryptoTradingAnalyzer") -and (-not (Test-Path -LiteralPath $IssPath))) { throw ".iss not found: $IssPath" }
if (($App -eq "CryptoMonitor") -and (-not (Test-Path -LiteralPath $CryptoMonitorIssPath))) { throw ".iss not found: $CryptoMonitorIssPath" }
if (-not (Test-Path -LiteralPath $RootAppVersionPath)) { throw "app_version.py not found: $RootAppVersionPath" }
if (-not (Test-Path -LiteralPath $CryptoAppVersionPath)) { throw "crypto-analyzer app_version.py not found: $CryptoAppVersionPath" }
if (($App -eq "CryptoMonitor") -and (-not (Test-Path -LiteralPath $CryptoMonitorMain))) { throw "CryptoMonitor main not found: $CryptoMonitorMain" }

function Set-AppVersionPy {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$NewVersion
  )
  $t = Get-Content -LiteralPath $Path -Raw
  $m = [regex]::Match($t, 'APP_VERSION\s*=\s*"([^"]+)"')
  if (-not $m.Success) { throw "APP_VERSION not found in: $Path" }
  $current = $m.Groups[1].Value
  if ($current -eq $NewVersion) {
    return
  }
  $t2 = $t -replace 'APP_VERSION\s*=\s*"[^"]+"', ('APP_VERSION = "' + $NewVersion + '"')
  Set-Content -LiteralPath $Path -Value $t2 -Encoding UTF8
}

function Set-AppVersionPyInCode {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$NewVersion
  )
  $t = Get-Content -LiteralPath $Path -Raw
  $m = [regex]::Match($t, 'APP_VERSION\s*=\s*"([^"]+)"')
  if (-not $m.Success) { throw "APP_VERSION not found in: $Path" }
  $current = $m.Groups[1].Value
  if ($current -eq $NewVersion) {
    return
  }
  $t2 = $t -replace 'APP_VERSION\s*=\s*"[^"]+"', ('APP_VERSION = "' + $NewVersion + '"')
  Set-Content -LiteralPath $Path -Value $t2 -Encoding UTF8
}

function ConvertTo-CryptoMonitorIssText {
  param(
    [Parameter(Mandatory=$true)][string]$IssText
  )
  $t = $IssText

  $t = [regex]::Replace($t, '(?m)^\s*LicenseFile\s*=\s*.*\r?\n', '')

  if ($t -match '(?m)^\s*AppId\s*=') {
    $t = [regex]::Replace($t, '(?m)^\s*AppId\s*=\s*.*$', 'AppId={{7A8F1C3E-5F30-4C12-9D2E-3E6A52B8F1D9}}')
  }

  if ($t -match '(?m)^\s*OutputBaseFilename\s*=') {
    $t = [regex]::Replace($t, '(?m)^\s*OutputBaseFilename\s*=\s*.*$', 'OutputBaseFilename=CryptoMonitor-Setup-latest')
  }

  $t = $t -replace 'dist\\CryptoPrice\\', 'dist\\CryptoMonitor\\'

  return $t
}

if ($App -eq "CryptoTradingAnalyzer") {
  Set-AppVersionPy -Path $RootAppVersionPath -NewVersion $Version
  Set-AppVersionPy -Path $CryptoAppVersionPath -NewVersion $Version
} elseif ($App -eq "CryptoMonitor") {
  Set-AppVersionPyInCode -Path $CryptoMonitorMain -NewVersion $Version
}

$SelectedIssPath = $IssPath
if ($App -eq "CryptoMonitor") {
  $SelectedIssPath = $CryptoMonitorIssPath
}

$issText = Get-Content -LiteralPath $SelectedIssPath -Raw
$mIss = [regex]::Match($issText, '#define\s+MyAppVersion\s+"([^"]+)"')
if (-not $mIss.Success) { throw "MyAppVersion not found in: $SelectedIssPath" }
$issText2 = $issText -replace '#define\s+MyAppVersion\s+"[^"]+"', ('#define MyAppVersion "' + $Version + '"')

if ($App -eq "CryptoMonitor") {
  $issText2 = ConvertTo-CryptoMonitorIssText -IssText $issText2
  if ($CryptoMonitorIco) {
    $issText2 = [regex]::Replace($issText2, '(?m)^\s*SetupIconFile\s*=\s*.*$', ('SetupIconFile="' + $CryptoMonitorIco + '"'))
  }
}

$TempIssPath = $null

if ($App -eq "CryptoMonitor") {
  $issDirTmp = Split-Path -Parent $SelectedIssPath
  $TempIssPath = Join-Path $issDirTmp ("CryptoMonitor_build_" + [Guid]::NewGuid().ToString("N") + ".iss")
  try {
    $utf8Bom = New-Object System.Text.UTF8Encoding $true
    [System.IO.File]::WriteAllText($TempIssPath, $issText2, $utf8Bom)
  } catch {
    Set-Content -LiteralPath $TempIssPath -Value $issText2 -Encoding UTF8
  }
} else {
  try {
    $utf8Bom = New-Object System.Text.UTF8Encoding $true
    [System.IO.File]::WriteAllText($SelectedIssPath, $issText2, $utf8Bom)
  } catch {
    Set-Content -LiteralPath $SelectedIssPath -Value $issText2 -Encoding UTF8
  }
}

if ((-not (Test-Path -LiteralPath $IcoPath)) -or ((Get-Item -LiteralPath $IcoPath).Length -le 0)) {
  if (-not (Test-Path -LiteralPath $MakeIcoScript)) { throw "make_favicon_ico.ps1 not found: $MakeIcoScript" }
  Write-Host "Generate favicon.ico..."
  & powershell -ExecutionPolicy Bypass -File $MakeIcoScript
  if ($LASTEXITCODE -ne 0) { throw "Icon generation failed (exit code $LASTEXITCODE)" }
}

if ((-not (Test-Path -LiteralPath $IcoPath)) -or ((Get-Item -LiteralPath $IcoPath).Length -le 0)) {
  throw "Invalid icon file (empty): $IcoPath"
}

Write-Host "1/3 PyInstaller build..."
if ($App -eq "CryptoTradingAnalyzer") {
  Push-Location $CryptoAnalyzerDir
  python -m PyInstaller --noconfirm --clean --onefile --windowed `
    --name "CryptoTradingAnalyzer" `
    --distpath "..\dist" `
    --workpath "..\build\desktop_app" `
    --icon "..\server-php\public\favicon.ico" `
    --collect-data "matplotlib" `
    --collect-submodules "matplotlib" `
    --add-data "templates;templates" `
    --add-data "static;static" `
    --add-data "..\server-php\public\favicon.ico;assets" `
    desktop_app.py
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit code $LASTEXITCODE)" }
  Pop-Location
} elseif ($App -eq "CryptoMonitor") {
  if (-not $CryptoMonitorIco) { throw "CryptoMonitor icon .ico not prepared" }
  Push-Location $CryptoMonitorDir
  try { Remove-Item -LiteralPath (Join-Path $CryptoMonitorDir "window_icon.ico") -Force } catch { }
  try { Remove-Item -LiteralPath (Join-Path $CryptoMonitorDir "CryptoMonitor.spec") -Force } catch { }
  try { Remove-Item -LiteralPath (Join-Path $CryptoMonitorDir "build") -Recurse -Force } catch { }
  try { Remove-Item -LiteralPath (Join-Path $CryptoMonitorDir "dist\CryptoMonitor") -Recurse -Force } catch { }
  $pyiArgs = @(
    "-m", "PyInstaller",
    "--noconfirm", "--clean", "--onedir", "--windowed",
    "--name", "CryptoMonitor",
    "--distpath", "dist",
    "--workpath", "build",
    "--icon", $CryptoMonitorIco,
    "--add-data", "tray_icon.png;.",
    "--add-data", "alert1.wav;.",
    "--add-data", "locales\ru.json;locales",
    "--add-data", "locales\en.json;locales",
    "--add-data", "locales\ua.json;locales",
    "--add-data", "app_icon.ico;.",
    "CryptoMonitor_new.py"
  )
  if (Test-Path -LiteralPath (Join-Path $CryptoMonitorDir "app_icon1.png")) {
    $pyiArgs = $pyiArgs[0..($pyiArgs.Count-2)] + @("--add-data", "app_icon1.png;.") + @($pyiArgs[-1])
  }
  if (Test-Path -LiteralPath (Join-Path $CryptoMonitorDir "app_icon.png")) {
    $pyiArgs = $pyiArgs[0..($pyiArgs.Count-2)] + @("--add-data", "app_icon.png;.") + @($pyiArgs[-1])
  }
  & python @pyiArgs
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit code $LASTEXITCODE)" }
  Pop-Location
}

Write-Host "2/3 Inno Setup compile..."
$IssDir = Split-Path -Parent $SelectedIssPath
$InstallerBase = "CryptoTradingAnalyzer-Setup-latest"
if ($App -eq "CryptoMonitor") {
  $InstallerBase = "CryptoMonitor-Setup-latest"
}
$InstallerName = "$InstallerBase.exe"

$TmpInstallerOutDir = Join-Path $env:TEMP ((($App.ToLower()) + "_inno_") + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TmpInstallerOutDir -Force | Out-Null
$InstallerPath = Join-Path $TmpInstallerOutDir $InstallerName

Push-Location $IssDir
if ($TempIssPath) {
  & $ISCCPath "/O$TmpInstallerOutDir" "/F$InstallerBase" $TempIssPath
} else {
  & $ISCCPath "/O$TmpInstallerOutDir" "/F$InstallerBase" $SelectedIssPath
}
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed (exit code $LASTEXITCODE)" }
Pop-Location

if ($TempIssPath) {
  try {
    Remove-Item -LiteralPath $TempIssPath -Force
  } catch {
  }
}

if (-not (Test-Path -LiteralPath $InstallerPath)) {
  throw "Installer not produced where expected: $InstallerPath"
}

if ($CryptoMonitorIconTmpDir) {
  try {
    Remove-Item -LiteralPath $CryptoMonitorIconTmpDir -Recurse -Force
  } catch {
  }
}

Write-Host "3/3 Generate latest.json + copy latest installer..."

$Channel = "cryptotradinganalyzer"
if ($App -eq "CryptoMonitor") {
  $Channel = "cryptomonitor"
}
$AppOutDir = Join-Path $OutDir $Channel
$LatestExeName = "$InstallerBase.exe"
$AppBaseUrl = "$BaseUrl/$Channel"

powershell -ExecutionPolicy Bypass -File $ReleaseScript `
  -Version $Version `
  -InstallerPath $InstallerPath `
  -ReleaseNotes $ReleaseNotes `
  -OutDir $AppOutDir `
  -LatestName $LatestExeName `
  -BaseUrl $AppBaseUrl

Write-Host ""
Write-Host "DONE. Upload these files to /downloads/$Channel/:"
Write-Host "- $AppOutDir\$LatestExeName"
Write-Host "- $AppOutDir\latest.json"