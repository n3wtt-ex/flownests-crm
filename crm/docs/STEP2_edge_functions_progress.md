# STEP 2 — API (Node/Deno) + PostgreSQL — Progress

Bu doküman, Instantly Reply (Step E) webhooks akışının geliştirme ilerlemesini, şema hizalamasını ve üretime hazırlık adımlarını özetler. Supabase bağımlılığı kaldırılmış olup mimari “API Katmanı (Node/Deno) + PostgreSQL (self-hosted)” şeklindedir.

## Özet

- Instantly Reply (Step E) akışı tamamlandı ve doğrulandı.
- Şema, deals için pipeline_id + stage_id modeline taşındı; eski `stage` kolonu kaldırıldı.
- Default pipeline ve 'New' stage tohumlandı (003_seed.sql).
- Idempotency davranışı (200/409) test ile doğrulandı.

## Yapılan Teknik İyileştirmeler

- Şema Uyumlaştırma:
  - pipelines ve pipeline_stages tabloları idempotent şekilde oluşturuldu.
  - deals tablosu, `pipeline_id` ve `stage_id` dış anahtarlarına göre hizalandı.
  - Eski `stage` kolonu kaldırıldı (NOT NULL ihlallerini engellemek için).
- Idempotent Constraint/Index:
  - uniq_pipelines_is_default (is_default UNIQUE)
  - uniq_pipeline_stages_name (pipeline_id, name)
  - uniq_pipeline_stages_order (pipeline_id, order_index)
  - uniq_deals_contact_stage (contact_id, stage_id) unique index
- Seed (003_seed.sql):
  - Default pipeline ve 'New' stage oluşturma
  - Demo owner/company/contact/deal
- Webhook Akışı (Step E):
  - Default pipeline ve 'New' stage look-up
  - contact_id + stage_id üzerinde deal upsert
  - system_note activity insert

## Test Sonuçları (Idempotency)

- İlk POST:
  - HTTP 200 OK
  - Body: `{"step":"E:deal_created_and_logged", "deal_id":"...", "system_activity_id":"..." }`
- Aynı POST (aynı idempotency_key):
  - HTTP 409
  - Body: `{"error":"Duplicate event (memory idempotency)"}`

## Prod Hardening

Bu bölüm, üretim ortamı için rol/izin sıkılaştırması, 002_policies rollout ve regresyon testlerini özetler. Detaylı rehber: `crm/docs/PROD_READINESS.md`.

### Roller

- app_admin: migration/DDL
- app_user: runtime (minimum yetki)
- readonly: SELECT-only raporlama

### 002_policies.sql Rollout

- Staging’de:
  - Roller oluşturulur (app_admin, app_user, readonly).
  - app_user için GRANT:
    - contacts: SELECT/INSERT/UPDATE
    - activities: SELECT/INSERT
    - deals: SELECT/INSERT/UPDATE
    - pipelines/pipeline_stages: SELECT
    - webhooks_log_dev (dev): INSERT
  - REVOKE: app_user’a DELETE/DDL verilmez.
  - Regresyon testleri (200/409) koşulur.
- Prod’da:
  - 002_policies uygulanır.
  - Deno env: PG_USER/PG_PASSWORD → app_user
  - 200/409 regresyon testleri tekrar koşulur.

### API/Runtime Env Önerisi

- PG_DATABASE=crm
- PG_USER=app_user
- LOG_LEVEL=info
- TLS, pooling (pgBouncer) opsiyonel fakat önerilir.
- JWT_SECRET=... (actions için)
- DEV_SIGNATURE_BYPASS=false
- HMAC_SHARED_SECRET_INSTANTLY=...
- HMAC_SHARED_SECRET_CALCOM=... (varsa)

### Sık Sorunlar

- ON CONFLICT: eksik UNIQUE/constraint → ilgili constraint/index ekleyin.
- permission denied: eksik GRANT → 002_policies’e idempotent GRANT ekleyin.
- deals.stage NOT NULL: eski kolonu kaldırın veya nullable yapın; yeni model stage_id/pipeline_id kullanır.

## Durum

- Step E tamamlandı ve üretime hazırlık planı belirlendi.
- Ayrıntılı prod rehberi için `crm/docs/PROD_READINESS.md` dosyasını takip edin.
