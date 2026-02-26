param(
  [string]$BaseUrl = "https://pdf-generator.dev.lunupay.com",
  [int]$Repeats = 2,
  [string]$OutDir = "",
  [switch]$TestRequestId,
  [switch]$TestBigPayload,
  [int]$BigTableRows = 250,
  [int]$BigStringSize = 20000,
  [switch]$TestChromeSandbox,
  [string]$ChromeSandboxQueryParamName = "chromeSandbox"
)

$ErrorActionPreference = "Stop"

function Join-Url([string]$base, [string]$path) {
  if ($base.EndsWith("/")) { $base = $base.TrimEnd("/") }
  if (-not $path.StartsWith("/")) { $path = "/" + $path }
  return $base + $path
}

function Get-BackendUrl([string]$url, [string]$backend) {
  if ([string]::IsNullOrWhiteSpace($backend)) { return $url }
  if ($url.Contains("?")) { return ($url + "&backend=" + $backend) }
  return ($url + "?backend=" + $backend)
}

function Add-QueryParams([string]$url, [hashtable]$params) {
  if ($params -eq $null -or $params.Count -eq 0) { return $url }
  $u = $url
  foreach ($k in $params.Keys) {
    $v = $params[$k]
    $encodedK = [System.Uri]::EscapeDataString([string]$k)
    $encodedV = [System.Uri]::EscapeDataString([string]$v)
    if ($u.Contains("?")) {
      $u = $u + "&" + $encodedK + "=" + $encodedV
    } else {
      $u = $u + "?" + $encodedK + "=" + $encodedV
    }
  }
  return $u
}

function Get-HeaderValue([string]$headersFile, [string]$headerName) {
  if (-not (Test-Path -LiteralPath $headersFile)) { return "" }
  $lines = Get-Content -LiteralPath $headersFile -ErrorAction SilentlyContinue
  if ($lines -eq $null) { return "" }
  $pattern = "^" + [Regex]::Escape($headerName) + "\s*:\s*(.*)$"
  $values = @($lines | Where-Object { $_ -match $pattern } | ForEach-Object { $Matches[1].Trim() })
  if ($values.Count -eq 0) { return "" }
  return $values[$values.Count - 1]
}

function New-BigPayloadBody([string]$jsonBody, [int]$tableRows, [int]$stringSize) {
  try {
    $obj = $jsonBody | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $jsonBody
  }

  $bigStr = ("A" * $stringSize)

  foreach ($p in @("client_legal_name", "account_name", "account_address", "invoice_number")) {
    if ($obj.PSObject.Properties.Name -contains $p) {
      $obj.$p = ([string]$obj.$p) + "_" + $bigStr
    }
  }

  if ($obj.PSObject.Properties.Name -contains "table" -and $obj.table -ne $null) {
    $orig = @($obj.table)
    if ($orig.Count -gt 0) {
      $newTable = New-Object System.Collections.Generic.List[object]
      for ($i = 0; $i -lt $tableRows; $i++) {
        $row = $orig[$i % $orig.Count] | ConvertTo-Json -Depth 50 | ConvertFrom-Json
        if ($row.PSObject.Properties.Name -contains "id") {
          $row.id = ([string]$row.id) + "-" + $i
        }
        if ($row.PSObject.Properties.Name -contains "description") {
          $row.description = @($bigStr)
        }
        $newTable.Add($row) | Out-Null
      }
      $obj.table = $newTable
    }
  }

  return ($obj | ConvertTo-Json -Depth 80)
}

function Test-IsPdf([string]$filePath) {
  try {
    if (-not (Test-Path -LiteralPath $filePath)) { return $false }
    $fs = [System.IO.File]::OpenRead($filePath)
    try {
      $buf = New-Object byte[] 4
      $read = $fs.Read($buf, 0, 4)
      if ($read -lt 4) { return $false }
      return ([System.Text.Encoding]::ASCII.GetString($buf) -eq "%PDF")
    } finally {
      $fs.Dispose()
    }
  } catch {
    return $false
  }
}

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutDir = Join-Path -Path (Get-Location) -ChildPath "pdf_backend_check_$stamp"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$requests = @(
  [pscustomobject]@{
    Name = "declaration-of-intent-default"
    Path = "/v1/declaration-of-intent-default"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
    "document_id":"test-doc-1",
    "version":"v1",
    "effective_date":"2026-01-08",
    "generated_by_system":"exchange",
    "client_legal_name":"ACME GmbH",
    "user_id":"test-user-1",
    "consent_timestamp":"2026-01-08T12:34:56Z",
    "channel":"viban_verification_spa",
    "onboarding_flow":"viban_customer_verification",
    "screen":"consent",
    "document_version_accepted":"v1",
    "document_hash_algorithm":"sha256",
    "document_hash":"3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
    "consent_event_id":"test-event-1"
}
'@
  },
  [pscustomobject]@{
    Name = "declaration-of-intent"
    Path = "/v1/declaration-of-intent"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
    "document_id":"test-doc-2",
    "version":"v1",
    "effective_date":"2026-01-10",
    "generated_by_system":"exchange",
    "client_legal_name":"ACME GmbH",
    "user_id":"test-user-2",
    "consent_timestamp":"2026-01-08T12:34:56Z",
    "channel":"viban_verification_spa",
    "onboarding_flow":"viban_customer_verification",
    "screen":"consent",
    "document_version_accepted":"v1",
    "document_hash_algorithm":"sha256",
    "document_hash":"3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
    "consent_event_id":"test-event-2"
}
'@
  },
  [pscustomobject]@{
    Name = "declaration-of-intent-australia"
    Path = "/v1/declaration-of-intent-australia"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
    "document_id":"test-doc-3",
    "version":"v1",
    "effective_date":"2026-01-10",
    "generated_by_system":"exchange",
    "client_legal_name":"ACME GmbH",
    "user_id":"test-user-2",
    "consent_timestamp":"2026-01-08T12:34:56Z",
    "channel":"viban_verification_spa",
    "onboarding_flow":"viban_customer_verification",
    "screen":"consent",
    "document_version_accepted":"v1",
    "document_hash_algorithm":"sha256",
    "document_hash":"3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
    "consent_event_id":"test-event-2"
}
'@
  },
  [pscustomobject]@{
    Name = "account-statement-v1"
    Path = "/v1/account-statement"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
  "document_id": "test-doc-3",
  "version": "v1",
  "effective_date": "2026-01-10",
  "generated_by_system": "exchange",
  "client_legal_name": "ACME GmbH",
  "user_id": "test-user-2",
  "account_id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
  "account_name": "merchant",
  "account_address": "merchant err",
  "opening_balance": "122",
  "total_in": "234",
  "total_out": "234",
  "sub_total": "345332",
  "total": "4565",
  "balance_due": "34545677",
  "fiat_code": "EUR",
  "fiat_symbol": "EUR",
  "invoice_number": "123656",
  "invoice_date": "2026-02-08",
  "due_date": "2026-02-08",
  "closing_balance": "2342",
  "date_from": "2026-02-08",
  "date_to": "2026-01-08",
  "table": [
    {
      "id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
      "table": "io",
      "tx_type": "payment",
      "columns": ["col1", "col2"],
      "fee": "34",
      "transaction_type": "test",
      "balance": "34",
      "description": ["test flow"],
      "quantity": "redsa",
      "rate": "test",
      "amount": "1234",
      "timestamp": "2026-01-08T12:34:56Z"
    }
  ],
  "consent_timestamp": "2026-01-08T12:34:56Z",
  "channel": "viban_verification_spa",
  "onboarding_flow": "viban_customer_verification",
  "screen": "consent",
  "document_version_accepted": "v1",
  "document_hash_algorithm": "sha256",
  "document_hash": "3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
  "consent_event_id": "test-event-2"
}
'@
  },
  [pscustomobject]@{
    Name = "account-statement-v2"
    Path = "/v2/account-statement"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
  "document_id": "test-doc-3",
  "version": "v1",
  "effective_date": "2026-01-10",
  "generated_by_system": "exchange",
  "client_legal_name": "ACME GmbH",
  "user_id": "test-user-2",
  "account_id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
  "account_name": "merchant",
  "account_address": "merchant err",
  "opening_balance": "122",
  "total_in": "234",
  "total_out": "234",
  "sub_total": "345332",
  "total": "4565",
  "balance_due": "34545677",
  "fiat_code": "EUR",
  "fiat_symbol": "EUR",
  "invoice_number": "123656",
  "invoice_date": "2026-02-08",
  "due_date": "2026-02-08",
  "closing_balance": "2342",
  "date_from": "2026-02-08",
  "date_to": "2026-01-08",
  "table": [
    {
      "id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
      "table": "io",
      "tx_type": "payment",
      "columns": ["col1", "col2"],
      "fee": "34",
      "transaction_type": "test",
      "balance": "34",
      "description": ["test flow"],
      "quantity": "redsa",
      "rate": "test",
      "amount": "1234",
      "timestamp": "2026-01-08T12:34:56Z"
    }
  ],
  "consent_timestamp": "2026-01-08T12:34:56Z",
  "channel": "viban_verification_spa",
  "onboarding_flow": "viban_customer_verification",
  "screen": "consent",
  "document_version_accepted": "v1",
  "document_hash_algorithm": "sha256",
  "document_hash": "3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
  "consent_event_id": "test-event-2"
}
'@
  },
  [pscustomobject]@{
    Name = "account-invoice"
    Path = "/v1/account-invoice"
    ContentType = "application/json"
    Accept = "application/pdf"
    Body = @'
{
  "document_id": "test-doc-3",
  "version": "v1",
  "effective_date": "2026-01-10",
  "generated_by_system": "exchange",
  "client_legal_name": "ACME GmbH",
  "user_id": "test-user-2",
  "account_id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
  "account_name": "merchant",
  "account_address": "merchant err",
  "opening_balance": "122",
  "total_in": "234",
  "total_out": "234",
  "sub_total": "345332",
  "total": "4565",
  "balance_due": "34545677",
  "fiat_code": "EUR",
  "fiat_symbol": "EUR",
  "invoice_number": "1768656",
  "invoice_date": "2026-02-08",
  "due_date": "2026-02-08",
  "closing_balance": "2342",
  "date_from": "2026-02-08",
  "date_to": "2026-01-08",
  "table": [
    {
      "id": "6bb834ba-9097-4a11-bd0b-c8703862a3ca",
      "table": "io",
      "tx_type": "payment",
      "columns": ["col1", "col2"],
      "fee": "34",
      "transaction_type": "test",
      "balance": "34",
      "description": ["вот"],
      "quantity": "redsa",
      "rate": "test",
      "amount": "1234",
      "timestamp": "2026-01-08T12:34:56Z"
    }
  ],
  "consent_timestamp": "2026-01-08T12:34:56Z",
  "channel": "viban_verification_spa",
  "onboarding_flow": "viban_customer_verification",
  "screen": "consent",
  "document_version_accepted": "v1",
  "document_hash_algorithm": "sha256",
  "balance_asset": "12324",
  "document_hash": "3ab85f8c3df4a2e63fb07a78d1c1ec7d77ea3ed7200fde27702a07d81d528221",
  "consent_event_id": "test-event-2"
}
'@
  },
  [pscustomobject]@{
    Name = "health"
    Path = "/v1/health"
    ContentType = "application/json"
    Accept = "application/json"
    Body = ""
  }
)

$backends = @(
  [pscustomobject]@{ Name = "default"; Value = ""; ExtraQuery = @{} },
  [pscustomobject]@{ Name = "chrome"; Value = "chrome"; ExtraQuery = @{} },
  [pscustomobject]@{ Name = "weasyprint"; Value = "weasyprint"; ExtraQuery = @{} }
)

if ($TestChromeSandbox) {
  $backends += [pscustomobject]@{ Name = "chrome_sandbox"; Value = "chrome"; ExtraQuery = @{ $ChromeSandboxQueryParamName = "true" } }
}

$requestIdModes = @(
  [pscustomobject]@{ Name = "auto"; Send = $false }
)

if ($TestRequestId) {
  $requestIdModes += [pscustomobject]@{ Name = "x_request_id"; Send = $true }
}

if ($TestBigPayload) {
  $extra = New-Object System.Collections.Generic.List[object]
  foreach ($r in $requests) {
    if (-not [string]::IsNullOrEmpty($r.Body) -and $r.Name -ne "health") {
      $extra.Add([pscustomobject]@{
        Name = ($r.Name + "-big")
        Path = $r.Path
        ContentType = $r.ContentType
        Accept = $r.Accept
        Body = (New-BigPayloadBody -jsonBody $r.Body -tableRows $BigTableRows -stringSize $BigStringSize)
      }) | Out-Null
    }
  }
  $requests = @($requests + $extra)
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($req in $requests) {
  $urlBase = Join-Url -base $BaseUrl -path $req.Path

  foreach ($be in $backends) {
    $url0 = Get-BackendUrl -url $urlBase -backend $be.Value
    $url = Add-QueryParams -url $url0 -params $be.ExtraQuery

    foreach ($ridMode in $requestIdModes) {
      for ($i = 1; $i -le $Repeats; $i++) {
        $runStamp = Get-Date -Format "yyyyMMdd_HHmmss_fff"
        $safeName = ($req.Name -replace "[^a-zA-Z0-9_-]", "-")
        $pdfPath = Join-Path -Path $OutDir -ChildPath "${safeName}__$($be.Name)__$($ridMode.Name)__run${i}__${runStamp}.bin"
        $hdrPath = Join-Path -Path $OutDir -ChildPath "${safeName}__$($be.Name)__$($ridMode.Name)__run${i}__${runStamp}.headers.txt"
        $bodyPath = Join-Path -Path $OutDir -ChildPath "${safeName}__$($be.Name)__$($ridMode.Name)__run${i}__${runStamp}.body.json"

        $headers = @()
        if (-not [string]::IsNullOrWhiteSpace($req.ContentType)) {
          $headers += "Content-Type: $($req.ContentType)"
        }
        if (-not [string]::IsNullOrWhiteSpace($req.Accept)) {
          $headers += "Accept: $($req.Accept)"
        }

        $requestIdSent = ""
        if ($ridMode.Send) {
          $requestIdSent = [Guid]::NewGuid().ToString("D")
          $headers += ("x-request-id: " + $requestIdSent)
        }

      $curlArgs = @(
        "-sS",
        "-L",
        "--connect-timeout", "10",
        "--max-time", "60",
        "-X", "POST",
        "-D", $hdrPath,
        "-o", $pdfPath,
        "-w", "HTTP:%{http_code} TIME:%{time_total} SIZE:%{size_download}"
      )

      foreach ($h in $headers) {
        $curlArgs += @("-H", $h)
      }

      if (-not [string]::IsNullOrEmpty($req.Body)) {
        [System.IO.File]::WriteAllText($bodyPath, $req.Body, (New-Object System.Text.UTF8Encoding($false)))
        $curlArgs += @("--data-binary", "@$bodyPath")
      }

        $status = ""
        $timeTotal = $null
        $sizeDl = $null
        $httpCode = $null
        $sha256 = ""
        $isPdf = $false
        $fileSize = 0
        $errorText = ""
        $responseRequestId = ""
        $responseContentType = ""

        try {
          $status = & curl.exe @curlArgs $url 2>&1

          if ($status -match "HTTP:(\d{3})") { $httpCode = $Matches[1] }
          if ($status -match "TIME:([0-9.]+)") { $timeTotal = [double]$Matches[1] }
          if ($status -match "SIZE:(\d+)") { $sizeDl = [int64]$Matches[1] }

          $responseRequestId = Get-HeaderValue -headersFile $hdrPath -headerName "x-request-id"
          $responseContentType = Get-HeaderValue -headersFile $hdrPath -headerName "content-type"

          if (Test-Path -LiteralPath $pdfPath) {
            $fileSize = (Get-Item -LiteralPath $pdfPath).Length
            $sha256 = (Get-FileHash -LiteralPath $pdfPath -Algorithm SHA256).Hash.ToLowerInvariant()
            $isPdf = Test-IsPdf -filePath $pdfPath
          }
        } catch {
          $errorText = $_.Exception.Message
        }

        $results.Add([pscustomobject]@{
          endpoint = $req.Name
          path = $req.Path
          backend = $be.Name
          request_id_mode = $ridMode.Name
          request_id_sent = $requestIdSent
          response_request_id = $responseRequestId
          response_content_type = $responseContentType
          run = $i
          url = $url
          http_code = $httpCode
          time_total = $timeTotal
          size_download = $sizeDl
          file_size = $fileSize
          sha256 = $sha256
          is_pdf = $isPdf
          out_file = $pdfPath
          headers_file = $hdrPath
          error = $errorText
        }) | Out-Null

        Start-Sleep -Milliseconds 150
      }
    }
  }
}

$csvPath = Join-Path -Path $OutDir -ChildPath "results.csv"
$results | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $csvPath

Write-Host "Saved results to: $csvPath"

$bad = $results | Where-Object {
  if ($_.endpoint -like "*-big" -and $_.http_code -eq "413" -and $_.error -eq "") { return $false }
  return ($_.error -ne "" -or $_.http_code -eq $null -or $_.http_code -notmatch "^2")
}
if ($bad.Count -gt 0) {
  Write-Host "\nFAILURES (error/non-2xx):" -ForegroundColor Red
  $bad | Select-Object endpoint, backend, run, http_code, time_total, file_size, error | Format-Table -AutoSize
}

$bigSummary = $results | Where-Object { $_.endpoint -like "*-big" } |
  Group-Object endpoint, backend, request_id_mode, http_code |
  ForEach-Object {
    [pscustomobject]@{
      endpoint = $_.Group[0].endpoint
      backend = $_.Group[0].backend
      request_id_mode = $_.Group[0].request_id_mode
      http_code = $_.Group[0].http_code
      runs = $_.Count
      max_time = ($_.Group | Where-Object { $_.time_total -ne $null } | Measure-Object -Property time_total -Maximum).Maximum
    }
  } |
  Sort-Object endpoint, backend, request_id_mode, http_code

if ($bigSummary.Count -gt 0) {
  Write-Host "\nBIG PAYLOAD summary (expect 413, no 500/timeouts):" -ForegroundColor Cyan
  $bigSummary | Format-Table -AutoSize

  $bigUnexpected = $results | Where-Object {
    $_.endpoint -like "*-big" -and $_.error -eq "" -and $_.http_code -ne $null -and $_.http_code -notmatch "^2" -and $_.http_code -ne "413"
  }
  if ($bigUnexpected.Count -gt 0) {
    Write-Host "\nUNEXPECTED status for BIG payload (not 2xx and not 413):" -ForegroundColor Yellow
    $bigUnexpected | Select-Object endpoint, backend, request_id_mode, run, http_code, time_total, response_request_id | Format-Table -AutoSize
  }
}

$nonPdf = $results | Where-Object { $_.endpoint -ne "health" -and (-not $_.is_pdf) -and $_.error -eq "" -and $_.http_code -match "^2" }
if ($nonPdf.Count -gt 0) {
  Write-Host "\nNON-PDF responses on PDF endpoints:" -ForegroundColor Yellow
  $nonPdf | Select-Object endpoint, backend, run, http_code, file_size, out_file | Format-Table -AutoSize
}

$flaps = $results |
  Where-Object { $_.endpoint -ne "health" -and $_.error -eq "" -and $_.http_code -match "^2" -and $_.sha256 -ne "" } |
  Group-Object endpoint, backend, request_id_mode |
  ForEach-Object {
    $hashes = ($_.Group | Select-Object -ExpandProperty sha256 | Sort-Object -Unique)
    [pscustomobject]@{
      endpoint = ($_.Group[0].endpoint)
      backend = ($_.Group[0].backend)
      request_id_mode = ($_.Group[0].request_id_mode)
      unique_hashes = $hashes.Count
      hashes = ($hashes -join ",")
      runs = $_.Count
    }
  } |
  Where-Object { $_.unique_hashes -gt 1 }

if ($flaps.Count -gt 0) {
  Write-Host "\nFLAPPING (different sha256 across runs):" -ForegroundColor Yellow
  $flaps | Select-Object endpoint, backend, request_id_mode, unique_hashes, runs | Format-Table -AutoSize
}

$ridMissingOnError = $results | Where-Object {
  ($_.error -ne "" -or $_.http_code -eq $null -or $_.http_code -notmatch "^2") -and [string]::IsNullOrWhiteSpace($_.response_request_id)
}

if ($ridMissingOnError.Count -gt 0) {
  Write-Host "\nMISSING x-request-id on errors/non-2xx:" -ForegroundColor Yellow
  $ridMissingOnError | Select-Object endpoint, backend, request_id_mode, run, http_code, error | Format-Table -AutoSize
}

$ridMismatch = $results | Where-Object { $_.request_id_mode -eq "x_request_id" -and $_.error -eq "" -and $_.http_code -match "^2" -and $_.request_id_sent -ne "" -and $_.response_request_id -ne "" -and $_.request_id_sent -ne $_.response_request_id }
if ($ridMismatch.Count -gt 0) {
  Write-Host "\nMISMATCH x-request-id (sent vs response):" -ForegroundColor Yellow
  $ridMismatch | Select-Object endpoint, backend, run, request_id_sent, response_request_id | Format-Table -AutoSize
}

Write-Host "\nDone. OutDir: $OutDir"
