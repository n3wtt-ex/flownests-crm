# CRM Webhooks

Bu doküman, Instantly Reply (Step E) webhook akışının son mimarisini, şema uyumunu ve test komutlarını içerir.

## 1) Mimari (Step E: Instantly Reply → CRM)

Kaynak: Instantly.io Reply Webhook  
Hedef: CRM (contacts, deals, activities) + idempotency

Akış Özeti:
1. Webhook alınır (JSON payload).
2. Idempotency kontrolü (memory tabanlı): aynı `idempotency_key` ikinci kez gelirse 409 döner.
3. Contact upsert (email bazlı).
4. Pipeline ve Stage lookup:
   - Default pipeline (is_default=true)
   - 'New' stage (pipeline_stages.name='New', pipeline_id=default pipeline)
5. Deal upsert:
   - contact_id + stage_id üzerinde benzersizlik (unique index: `uniq_deals_contact_stage`)
   - yoksa oluşturulur; varsa güncellenir.
6. Activity insert:
   - type=system (system_note)
   - related_type=deal | related_id=deal_id
7. Response:
   - İlk istek: 200 OK, `{"step":"E:deal_created_and_logged", "deal_id":"...","system_activity_id":"..." }`
   - Aynı istek tekrar: 409 `{"error":"Duplicate event (memory idempotency)"}`

## 2) Şema Uyum Notları

- deals modeli:
  - Yeni model: `pipeline_id` (FK → pipelines.id), `stage_id` (FK → pipeline_stages.id)
  - Eski `stage` kolonu kullanılmıyor; NOT NULL ihlallerini önlemek için bu kolon kaldırıldı.
- pipelines/pipeline_stages:
  - `pipelines.is_default` için UNIQUE constraint (tek default)
  - `pipeline_stages` için benzersizlik:
    - (pipeline_id, name)
    - (pipeline_id, order_index)
- deals idempotency:
  - `uniq_deals_contact_stage` → (contact_id, stage_id) üzerinde UNIQUE INDEX

İlgili SQL dosyaları:
- `crm/sql/_minimal_pipelines_setup.sql`
- `crm/sql/_minimal_support_tables.sql`
- `crm/sql/_add_unique_constraints_for_seed.sql`
- `crm/sql/003_seed.sql`

## 3) Lokal Geliştirme ve Test Komutları

Server:
deno run -A --reload "C:\cursor\özel satış otomasyonu\crm\functions\crm-webhooks\instantly-reply\index.ts"

İlk POST (200 beklenir):
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://127.0.0.1:8000" -ContentType "application/json" -Body "{ ""event"": ""reply"", ""campaign_id"": ""cmp_789"", ""lead"": { ""email"": ""mike@globex.com"", ""full_name"": ""Mike Neo"", ""website"": ""https://globex.example"" }, ""message"": { ""text"": ""pricing details?"", ""subject"": ""Re: Intro"", ""received_at"": ""2025-08-05T10:00:00Z"" }, ""idempotency_key"": ""evt_pg_010"" }"

Beklenen yanıt (örnek):
- Status: 200 OK
- Body: `{"status":"ok","step":"E:deal_created_and_logged","idempotency_key":"evt_pg_010","contact_id":"...","activity_id":"...","reply_status":"...","reply_summary":"...","deal_id":"...","system_activity_id":"..."}`

Aynı POST (409 beklenir):
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://127.0.0.1:8000" -ContentType "application/json" -Body "{ ""event"": ""reply"", ""campaign_id"": ""cmp_789"", ""lead"": { ""email"": ""mike@globex.com"", ""full_name"": ""Mike Neo"", ""website"": ""https://globex.example"" }, ""message"": { ""text"": ""pricing details?"", ""subject"": ""Re: Intro"", ""received_at"": ""2025-08-05T10:00:00Z"" }, ""idempotency_key"": ""evt_pg_010"" }"

Beklenen yanıt:
- Status: 409
- Body: `{"error":"Duplicate event (memory idempotency)"}`

## 4) Sık Sorunlar ve Çözümler

- ON CONFLICT hataları:
  - İlgili tablo için UNIQUE constraint/index eksik olabilir.
  - Çözüm: `_add_unique_constraints_for_seed.sql` dosyasını çalıştırın.
- permission denied:
  - Prod/staging’de 002_policies rollout sonrası eksik GRANT olabilir.
  - Çözüm: `crm/docs/PROD_READINESS.md` rehberine göre idempotent GRANT ekleyin.
- deals.stage NOT NULL hatası:
  - Eski kolondan kaynaklanır; yeni model `stage_id/pipeline_id` kullanır.
  - Çözüm: `ALTER TABLE deals DROP COLUMN IF EXISTS stage;`

## 5) İlgili Dokümanlar

- `crm/docs/STEP2_edge_functions_progress.md` — Step E ilerleme ve prod hardening özeti
- `crm/docs/PROD_READINESS.md` — Rollout, roller/izinler, env dönüşümü, test ve checklist
