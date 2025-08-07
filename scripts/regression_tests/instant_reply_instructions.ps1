# Usage: Open PowerShell, then run this script line-by-line or as a whole after adjusting APP_USER_PASSWORD and (optionally) SECRET.
# This script avoids chat formatting issues by providing clean, ready-to-run PowerShell commands.

# 0) Optional: Set working directory to repo root (adjust if needed)
Set-Location "C:\cursor\özel satış otomasyonu"

# 1) Set environment variables for server (HMAC ON)
# Replace <APP_USER_PASSWORD> with your real password. Optionally replace the generated secret with your own.
$env:PG_HOST = "localhost"
$env:PG_PORT = "5432"
$env:PG_DATABASE = "crm"
$env:PG_USER = "app_user"
$env:PG_PASSWORD = "<APP_USER_PASSWORD>"
$env:DEV_SIGNATURE_BYPASS = "false"

# Generate a strong random secret (or set your own string)
$env:HMAC_SHARED_SECRET_INSTANTLY = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# 2) Start the Deno server (run in a separate PowerShell window and keep it running)
# In a NEW PowerShell window, execute ONLY the two lines below:
# Set-Location "C:\cursor\özel satış otomasyonu"
# deno run -A --env "C:\cursor\özel satış otomasyonu\crm\functions\crm-webhooks\instantly-reply\index.ts"

# 3) Prepare payload and compute HMAC-SHA256 signature (hex)
$payload = '{ "event": "reply", "campaign_id": "cmp_789", "lead": { "email": "mike@globex.com", "full_name": "Mike Neo", "website": "https://globex.example" }, "message": { "text": "pricing details?", "subject": "Re: Intro", "received_at": "2025-08-05T10:00:00Z" }, "idempotency_key": "evt_pg_010" }'

$secret = $env:HMAC_SHARED_SECRET_INSTANTLY
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hashBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
$signature = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "X-Signature:" $signature

# 4) Run regression test script with correct URL and signature (two POSTs: expect 200 then 409)
    & ".\scripts\regression_tests\instant_reply.ps1" `
    -Url "http://localhost:8000" `
    -IdempotencyKey "evt_pg_010" `
    -SignatureHeaderName "X-Signature" `
    -SignatureValue $signature `
    -VerboseOutput

# Expected:
# First POST StatusCode: 200  (body contains step: E:deal_created_and_logged)
# Second POST Error (expected 409): Duplicate event (memory idempotency)
