Param(
  [string]$Url = "http://127.0.0.1:8000",
  [string]$IdempotencyKey = "evt_pg_010",
  [string]$SignatureHeaderName = "X-Signature",
  [string]$SignatureValue = "REPLACE_WITH_VALID_SIGNATURE_OR_USE_DEV_BYPASS_FALSE_AND_REAL_SIGN",
  [switch]$VerboseOutput
)

$payload = @{
  event = "reply"
  campaign_id = "cmp_789"
  lead = @{
    email = "mike@globex.com"
    full_name = "Mike Neo"
    website = "https://globex.example"
  }
  message = @{
    text = "pricing details?"
    subject = "Re: Intro"
    received_at = "2025-08-05T10:00:00Z"
  }
  idempotency_key = $IdempotencyKey
} | ConvertTo-Json -Depth 5

if ($VerboseOutput) {
  Write-Host ("POST URL: {0}" -f $Url)
  Write-Host ("Idempotency-Key: {0}" -f $IdempotencyKey)
  # Use format operator to avoid PowerShell parsing ':' as drive qualifier in variable names
  Write-Host ("Signature header: {0}: {1}" -f $SignatureHeaderName, $SignatureValue)
  Write-Host "Payload:`n$payload"
}

# First POST (expect 200)
try {
  $headers = @{
    "Content-Type" = "application/json"
    "Idempotency-Key" = $IdempotencyKey
  }
  if ($SignatureHeaderName -and $SignatureValue) {
    $headers[$SignatureHeaderName] = $SignatureValue
  }

  $resp1 = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $Url -ContentType "application/json" -Body $payload -Headers $headers
  Write-Host "First POST StatusCode: $($resp1.StatusCode)"
  Write-Host "First POST Body:`n$($resp1.Content)"
} catch {
  Write-Host "First POST Error: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $body = $reader.ReadToEnd()
    Write-Host "First POST Error Body:`n$body"
  }
}

Start-Sleep -Seconds 1

# Second POST (expect 409)
try {
  $headers2 = @{
    "Content-Type" = "application/json"
    "Idempotency-Key" = $IdempotencyKey
  }
  if ($SignatureHeaderName -and $SignatureValue) {
    $headers2[$SignatureHeaderName] = $SignatureValue
  }

  $resp2 = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $Url -ContentType "application/json" -Body $payload -Headers $headers2
  Write-Host "Second POST StatusCode: $($resp2.StatusCode)"
  Write-Host "Second POST Body:`n$($resp2.Content)"
} catch {
  Write-Host "Second POST Error (expected 409): $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader2 = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader2.BaseStream.Position = 0
    $reader2.DiscardBufferedData()
    $body2 = $reader2.ReadToEnd()
    Write-Host "Second POST Error Body:`n$body2"
  }
}
