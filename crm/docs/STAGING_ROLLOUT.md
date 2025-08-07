# STAGING ROLLOUT — HMAC İmza ve Idempotency Doğrulaması (STEP 2 Kapanış)

Bu doküman, Instantly Reply webhook’unda HMAC doğrulamasını etkinleştirerek 200/409 idempotency testinin başarıyla tamamlanması için kullanılan adımları, ortam değişkenlerini ve komutları kayıt altına alır. Amaç: ileride aynı doğrulama ve testleri hızlıca tekrarlayabilmek.

Durum:
- HMAC doğrulaması: AÇIK (DEV_SIGNATURE_BYPASS=false)
- İmzalama algoritması: HMAC-SHA256 (raw body üzerinden, hex lower-case)
- Idempotency: In-memory (dev) → 200/409 doğrulandı

İlgili dosyalar:
- Function: crm/functions/crm-webhooks/instantly-reply/index.ts
- Test script: scripts/regression_tests/instant_reply.ps1
- Talimat: scripts/regression_tests/instant_reply_instructions.ps1

---

## 1) Ortam Değişkenleri (PowerShell)

Server (Pencere A — Server):

Set-Location "C:\cursor\özel satış otomasyonu"

$env:PG_HOST = "localhost"
$env:PG_PORT = "5432"
$env:PG_DATABASE = "crm"
$env:PG_USER = "app_user"          # staging/prod için minimum yetkili rol
$env:PG_PASSWORD = "<APP_USER_PASSWORD>"

$env:DEV_SIGNATURE_BYPASS = "false" # HMAC zorunlu
$env:HMAC_SHARED_SECRET_INSTANTLY = "test" # Staging'de test için kullandığımız örnek secret

Not: HMAC_SHARED_SECRET_INSTANTLY prod’da gerçek/signing secret olmalı. “test” yalnızca yerel/staging demonstrasyon içindir.

---

## 2) Server’ı Çalıştırma (Deno)

deno run -A --env "C:\cursor\özel satış otomasyonu\crm\functions\crm-webhooks\instantly-reply\index.ts"

Beklenen log (örnek):
Listening on http://localhost:8000/ (http://localhost:8000/)

---

## 3) Payload (Raw) — İmza Bu Metin Üzerinden Hesaplanır

Aşağıdaki JSON metni bire bir kullanılmalıdır (boşluk/karakter farklılıkları HMAC’i değiştirir):

{ "event": "reply", "campaign_id": "cmp_789", "lead": { "email": "mike@globex.com", "full_name": "Mike Neo", "website": "https://globex.example" }, "message": { "text": "pricing details?", "subject": "Re: Intro", "received_at": "2025-08-05T10:00:00Z" }, "idempotency_key": "evt_pg_010" }

İpucu: scripts/regression_tests/instant_reply_instructions.ps1 içindeki $payload değeri bu metnin birebir kopyasıdır.

---

## 4) İmza (X-Signature) Üretimi — PowerShell (Pencere B — Test)

$secret = "test"
$payload = '{ "event": "reply", "campaign_id": "cmp_789", "lead": { "email": "mike@globex.com", "full_name": "Mike Neo", "website": "https://globex.example" }, "message": { "text": "pricing details?", "subject": "Re: Intro", "received_at": "2025-08-05T10:00:00Z" }, "idempotency_key": "evt_pg_010" }'
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hashBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
$signature = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
$signature

Örnek imza çıktıları (kullanılan secret/payload’a göre değişir):
- 71e359e13f0c26ac145e6b9db912e60dfb0c3355bdb787bb1068baccad698bca
- 3f97a788e26cbf92c5539ec08b78dd4f27a4debf0712d31d4511d82983b6d689

---

## 5) HTTP Test Çağrıları

A) Tek satırlık Invoke-WebRequest
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://localhost:8000" -ContentType "application/json" -Body '{ "event": "reply", "campaign_id": "cmp_789", "lead": { "email": "mike@globex.com", "full_name": "Mike Neo", "website": "https://globex.example" }, "message": { "text": "pricing details?", "subject": "Re: Intro", "received_at": "2025-08-05T10:00:00Z" }, "idempotency_key": "evt_pg_010" }' -Headers @{ "X-Signature" = $signature; "Idempotency-Key" = "evt_pg_010" }

Beklenen:
- İlk POST → 200 OK ve body’de "step":"E:deal_created_and_logged"
- Aynı POST tekrar → 409 ve body: {"error":"Duplicate event (memory idempotency)"}

B) Script ile (önerilen)
& ".\scripts\regression_tests\instant_reply.ps1" -Url "http://localhost:8000" -IdempotencyKey "evt_pg_010" -SignatureHeaderName "X-Signature" -SignatureValue $signature -VerboseOutput

Not: Boşluk içeren path’lerde & "C:\...\script.ps1" biçimi kullanılmalı. Çok satıra bölünecekse satır sonuna backtick (`) konulmalı.

---

## 6) Sık Hatalar ve Çözümler

- signature_missing (401): X-Signature header yok.
- signature_invalid (403): Secret/payload uyuşmuyor. Secret’ın server penceresinde set edildiğini ve imzanın raw payload üzerinden üretildiğini doğrula.
- 409 Duplicate event: Beklenen idempotency sonucu (aynı Idempotency-Key ile tekrar gönderimde).
- PowerShell ParserError (":" drive qualifier): Write-Host içinde ":" kullandığımız satırlarda format operatorü (-f) kullanılmalı. scripts/regression_tests/instant_reply.ps1 güncellendi.

---

## 7) STEP 2 Kapanış Notu

- HMAC doğrulama AÇIK (DEV_SIGNATURE_BYPASS=false) iken:
  - İlk POST: 200 OK, "E:deal_created_and_logged"
  - İkinci POST: 409 Duplicate event
- Doğrulama başarıyla tamamlandı. STEP 2 — Edge Functions (Deno) — Tamamlama kriteri sağlandı.

---

## 8) STEP 3 — İlk Görevler (Plan — Uygulama Yapılmayacak)

Kapsam (n8n ve otomasyonlar için hazırlık):
1) instantly_reply_ingest_workflow.json (taslak)
   - Webhook trigger (test endpoint)
   - Normalize payload
   - (S2) Mock AI intent → (S3) Gerçek LLM entegrasyonu (OpenAI/Bedrock)
   - contacts.reply_status/summary update
   - Deal yoksa create + stage=Qualified
   - Activity log

2) calcom_booking_ingest_workflow.json (taslak)
   - Webhook trigger
   - Attendee email → contact/deal lookup
   - deals.stage = Meeting Scheduled
   - Activity insert
   - Opsiyonel Slack notify

3) crm_stage_change_outbound.json (taslak)
   - CRM’den stage değişim webhook’u ingest
   - Koşullu aksiyon: not_interested → Instantly remove-from-campaign
   - Şimdilik log; S3’te gerçek API entegrasyonu

4) Güvenlik/Dayanıklılık
   - Webhook HMAC doğrulaması n8n tarafında da doğrulanır (opsiyonel proxy).
   - Idempotency anahtar akışı; retry/hata yönetimi.
   - Logging ve minimal observability.

Not: Bu adımda sadece plan hazırlandı; uygulama Step 3 kapsamında yapılacaktır.
