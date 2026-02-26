param(
  [Parameter(Mandatory=$true)]
  [string]$Version,

  [Parameter(Mandatory=$true)]
  [string]$InstallerPath,

  [string]$ReleaseNotes = "",

  [string]$OutDir = "release_artifacts",

  [string]$LatestName = "CryptoTradingAnalyzer-Setup-latest.exe",

  [string]$BaseUrl = "https://cryptoanalyz.net/downloads"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InstallerPath)) {
  throw "Installer not found: $InstallerPath"
}

$hash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash.ToLower()

if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$latestName = $LatestName
$latestPath = Join-Path $OutDir $latestName
Copy-Item -LiteralPath $InstallerPath -Destination $latestPath -Force

$manifest = [ordered]@{
  version = $Version
  installer_url = "$BaseUrl/$latestName"
  sha256 = $hash
  release_notes = $ReleaseNotes
}

$manifestPath = Join-Path $OutDir "latest.json"
($manifest | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "OK"
Write-Host "- Installer: $latestPath"
Write-Host "- Manifest:  $manifestPath"
Write-Host "- SHA256:    $hash"
