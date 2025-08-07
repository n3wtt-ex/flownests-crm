# STEP 1 — Database & Documentation (Completed)

Durum: TAMAMLANDI
Tarih: 2025-08-04

Bu adımda CRM modülünün temel veri katmanı, güvenlik politikaları ve API/Webhook/UI sözleşme dokümantasyonu hazırlandı. Amaç, Sprint 1’in devamındaki Edge Functions (API iskeleti), n8n iş akışları ve UI iskeletine sağlam bir temel oluşturmaktır.

---

## Üretilen Dosyalar

1) Veritabanı (Postgres/Supabase)
- sql/001_crm_schema.sql
  - Tablolar: owners, companies, contacts, pipelines, pipeline_stages, deals, activities, webhooks_log
  - Index’ler, updated_at trigger fonksiyonu ve tetikleyicileri
- sql/002_policies.sql
  - RLS (Row Level Security) politikaları
  - current_owner_id() yardımcı fonksiyonu (JWT email -> owners eşlemesi)
  - owners/companies/contacts/deals/pipelines/pipeline_stages/activities/webhooks_log için RLS kuralları
- sql/003_seed.sql
  - Default pipeline + stage’ler (New -> Won/Lost)
  - Örnek owner (owner@example.com)
  - Örnek company/contact/deal ve system activity

2) Dokümantasyon
- docs/crm_api.md
  - Inbound webhooks: /crm/webhooks/instantly/reply, /crm/webhooks/calcom/booking
  - Actions: /crm/actions/deals, /crm/actions/deals/:id/stage, /crm/actions/contacts
  - Güvenlik: JWT, HMAC-SHA256 imza, Idempotency, hata kodları
- docs/crm_webhooks.md
  - Inbound/Outbound event payload’ları, imza doğrulama örneği, idempotency stratejisi
- docs/crm_ui.md
  - /app/crm altında embed UI iskeleti
  - Komponentler: Kanban, DealDetail, ActivityTimeline, ContactQuick
  - services/crmApi.ts fetch yardımcıları (okuma için)
  - Sayfa iskeletleri ve UX ilkeleri

---

## Doğrulama / Kabul Kriterleri

- DB Şeması:
  - Tüm tablolar ve ilişkiler oluşturulabilir durumda.
  - updated_at tetikleyicileri çalışacak biçimde tanımlı.
- Güvenlik:
  - RLS etkin ve policies dosyasında owner bazlı kurallar tanımlı.
  - current_owner_id() fonksiyonu JWT email alanını okur (Supabase Auth uyumlu).
- Seed:
  - Default pipeline/stages, örnek veriler eklenebilir (idempotent).
- Sözleşmeler:
  - API/Webhook/UI dokümanları Sprint 1 hedefleriyle uyumlu ve yeterince ayrıntılı.

---

## Bir Sonraki Adımlar

STEP 2 — API Edge Functions (TypeScript İskeleti)
- functions/crm-webhooks/instantly-reply: POST endpoint, signature iskeleti, idempotency, contact upsert + activity + mock intent
- functions/crm-webhooks/calcom-booking: POST endpoint, booking -> stage=Meeting Scheduled, activity
- functions/crm-actions:
  - POST /crm/actions/deals (create/update basit)
  - POST /crm/actions/deals/:id/stage (stage update + outbound log)
  - POST /crm/actions/contacts (create/update basit)

STEP 3 — n8n İş Akışları (Taslaklar)
- workflows/instantly_reply_ingest_workflow.json
- workflows/calcom_booking_ingest_workflow.json
- workflows/crm_stage_change_outbound.json

STEP 4 — UI İskeleti (Read-Only)
- web/app/crm/ (Kanban, DealDetail, ActivityTimeline, ContactQuick)
- web/app/services/crmApi.ts (okuma fonksiyonları)

Not: Her adım tamamlandığında ayrı bir STEP_*.md dosyası oluşturulacak ve ana crm.md güncellenecektir.
