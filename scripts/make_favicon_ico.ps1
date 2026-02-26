param(
  [string]$InputPng = "..\client\public\favicon.png",
  [string]$OutputIco = "..\server-php\public\favicon.ico",
  [int[]]$Sizes = @(16, 24, 32, 48, 64, 128, 256)
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function Write-UInt16LE([System.IO.BinaryWriter]$bw, [int]$value) {
  $bw.Write([byte]($value -band 0xFF))
  $bw.Write([byte](($value -shr 8) -band 0xFF))
}

function Write-UInt32LE([System.IO.BinaryWriter]$bw, [uint32]$value) {
  $bw.Write([byte]($value -band 0xFF))
  $bw.Write([byte](($value -shr 8) -band 0xFF))
  $bw.Write([byte](($value -shr 16) -band 0xFF))
  $bw.Write([byte](($value -shr 24) -band 0xFF))
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$inPath = $InputPng
$outPath = $OutputIco
if (-not [System.IO.Path]::IsPathRooted($inPath)) {
  $inPath = Join-Path $ScriptDir $inPath
}
if (-not [System.IO.Path]::IsPathRooted($outPath)) {
  $outPath = Join-Path $ScriptDir $outPath
}

if (-not (Test-Path -LiteralPath $inPath)) {
  throw "Input PNG not found: $inPath"
}

$source = [System.Drawing.Image]::FromFile($inPath)
try {
  $images = @()

  foreach ($s in $Sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.DrawImage($source, 0, 0, $s, $s)
    } finally {
      $g.Dispose()
    }

    $ms = New-Object System.IO.MemoryStream
    try {
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $images += ,@($s, $ms.ToArray())
    } finally {
      $ms.Dispose()
      $bmp.Dispose()
    }
  }

  $fs = New-Object System.IO.FileStream($outPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $bw = New-Object System.IO.BinaryWriter($fs)

  try {
    # ICONDIR
    Write-UInt16LE $bw 0      # reserved
    Write-UInt16LE $bw 1      # type
    Write-UInt16LE $bw $images.Count # count

    $dirEntrySize = 16
    $offset = 6 + ($images.Count * $dirEntrySize)

    # ICONDIRENTRY(s)
    foreach ($item in $images) {
      $size = [int]$item[0]
      $pngBytes = [byte[]]$item[1]

      $w = if ($size -ge 256) { 0 } else { $size }
      $h = if ($size -ge 256) { 0 } else { $size }

      $bw.Write([byte]$w)  # width
      $bw.Write([byte]$h)  # height
      $bw.Write([byte]0)   # color count
      $bw.Write([byte]0)   # reserved
      Write-UInt16LE $bw 1     # planes
      Write-UInt16LE $bw 32    # bitcount
      Write-UInt32LE $bw ([uint32]$pngBytes.Length)  # bytes in res
      Write-UInt32LE $bw ([uint32]$offset)           # image offset

      $offset += $pngBytes.Length
    }

    # Image data
    foreach ($item in $images) {
      $bw.Write([byte[]]$item[1])
    }
  } finally {
    $bw.Dispose()
    $fs.Dispose()
  }

} finally {
  $source.Dispose()
}

Write-Host "OK: $outPath"
