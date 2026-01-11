param(
  [Parameter(Mandatory=$true)]
  [string]$Version,

  [string]$ReleaseNotes = "",

  [string]$BaseUrl = "https://cryptoanalyz.net/downloads",

  [string]$ISCCPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$CryptoAnalyzerDir = Join-Path $RepoRoot "crypto-analyzer"
$IssPath = Join-Path $RepoRoot "installer\windows\CryptoInsightX.iss"
$ReleaseScript = Join-Path $RepoRoot "scripts\release.ps1"
$OutDir = Join-Path $RepoRoot "release_artifacts"

$RootAppVersionPath = Join-Path $RepoRoot "app_version.py"
$CryptoAppVersionPath = Join-Path $RepoRoot "crypto-analyzer\app_version.py"

$IcoPath = Join-Path $RepoRoot "server-php\public\favicon.ico"
$MakeIcoScript = Join-Path $RepoRoot "scripts\make_favicon_ico.ps1"

if (-not (Test-Path -LiteralPath $ISCCPath)) { throw "ISCC.exe not found: $ISCCPath" }
if (-not (Test-Path -LiteralPath $IssPath)) { throw ".iss not found: $IssPath" }
if (-not (Test-Path -LiteralPath $RootAppVersionPath)) { throw "app_version.py not found: $RootAppVersionPath" }
if (-not (Test-Path -LiteralPath $CryptoAppVersionPath)) { throw "crypto-analyzer app_version.py not found: $CryptoAppVersionPath" }

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

Set-AppVersionPy -Path $RootAppVersionPath -NewVersion $Version
Set-AppVersionPy -Path $CryptoAppVersionPath -NewVersion $Version

$issText = Get-Content -LiteralPath $IssPath -Raw
$mIss = [regex]::Match($issText, '#define\s+MyAppVersion\s+"([^"]+)"')
if (-not $mIss.Success) { throw "MyAppVersion not found in: $IssPath" }
$issText2 = $issText -replace '#define\s+MyAppVersion\s+"[^"]+"', ('#define MyAppVersion "' + $Version + '"')
try {
  $utf8Bom = New-Object System.Text.UTF8Encoding $true
  [System.IO.File]::WriteAllText($IssPath, $issText2, $utf8Bom)
} catch {
  Set-Content -LiteralPath $IssPath -Value $issText2 -Encoding UTF8
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
Push-Location $CryptoAnalyzerDir
python -m PyInstaller --noconfirm --clean --onefile --windowed `
  --name "CryptoTradingAnalyzer" `
  --distpath "..\dist" `
  --workpath "..\build\desktop_app" `
  --icon "..\server-php\public\favicon.ico" `
  --add-data "templates;templates" `
  --add-data "static;static" `
  --add-data "..\server-php\public\favicon.ico;assets" `
  desktop_app.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit code $LASTEXITCODE)" }
Pop-Location

Write-Host "2/3 Inno Setup compile..."
$IssDir = Split-Path -Parent $IssPath
$InstallerBase = "CryptoTradingAnalyzer-Setup-latest"
$InstallerName = "$InstallerBase.exe"

$TmpInstallerOutDir = Join-Path $env:TEMP ("cryptotradinganalyzer_inno_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TmpInstallerOutDir -Force | Out-Null
$InstallerPath = Join-Path $TmpInstallerOutDir $InstallerName

Push-Location $IssDir
& $ISCCPath "/O$TmpInstallerOutDir" "/F$InstallerBase" $IssPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed (exit code $LASTEXITCODE)" }
Pop-Location
if (-not (Test-Path -LiteralPath $InstallerPath)) {
  throw "Installer not produced where expected: $InstallerPath"
}

Write-Host "3/3 Generate latest.json + copy latest installer..."
powershell -ExecutionPolicy Bypass -File $ReleaseScript `
  -Version $Version `
  -InstallerPath $InstallerPath `
  -ReleaseNotes $ReleaseNotes `
  -OutDir $OutDir `
  -BaseUrl $BaseUrl

Write-Host ""
Write-Host "DONE. Upload these files to /downloads/:"
Write-Host "- $OutDir\CryptoTradingAnalyzer-Setup-latest.exe"
Write-Host "- $OutDir\latest.json"