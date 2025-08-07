Param(
  [string]$Url = "https://n8n.flownests.org/webhook-test/calcom-booking",
  [string]$IdempotencyKey = "cal_evt_test_001",
  [string]$Email = "john@acme.com",
  [string]$Name = "John Doe",
  [string]$Title = "Discovery Call",
  [string]$StartTime = "2025-08-05T10:00:00.000Z",
  [string]$EndTime = "2025-08-05T10:30:00.000Z",
  [string]$Pipeline = "Default Sales"
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing Cal.com booking payload..."

$payloadObj = [ordered]@{
  event = "booking.created"
  booking = [ordered]@{
    id = "bk_test_001"
    title = $Title
    start_time = $StartTime
    end_time   = $EndTime
    attendees  = @(
      [ordered]@{
        email = $Email
        name  = $Name
      }
    )
    metadata = [ordered]@{
      pipeline = $Pipeline
    }
  }
  idempotency_key = $IdempotencyKey
}

$payloadJson = $payloadObj | ConvertTo-Json -Depth 6
$tempPath = Join-Path $env:TEMP "calcom_booking_test.json"
Set-Content -Path $tempPath -Value $payloadJson -Encoding UTF8

Write-Host ("Saved payload to: {0}" -f $tempPath)
Write-Host ("POST {0}" -f $Url)

try {
  $headers = @{
    "Content-Type"    = "application/json"
    "Idempotency-Key" = $IdempotencyKey
  }

  Write-Host "Sending with Invoke-RestMethod (in-memory JSON, no file/BOM)..."
  $resp = Invoke-RestMethod -Method Post -Uri $Url -Headers $headers -Body $payloadJson -ContentType "application/json"
  Write-Host "Response (parsed):"
  $resp | ConvertTo-Json -Depth 6
}
catch {
  Write-Host ("Request failed: {0}" -f $_.Exception.Message)
  if ($_.ErrorDetails.Message) {
    Write-Host ("Error Details: {0}" -f $_.ErrorDetails.Message)
  }
  exit 1
}

Write-Host "Done."
