# CRM Modülü Yol Haritası ve Görev Listesi (Aşama 5)

Hedef: Minimalist, modern, gömülebilir (Instantly benzeri panel) ve mevcut mimariyle (n8n, Supabase/Postgres, Instantly, cal.com, BrightData/Apify) tam uyumlu CRM modülünü 2 sprintte çalışır demo iskeletiyle hayata geçirmek.

Not: Token sınırı nedeniyle çalışma adım adım ilerleyecek. Bu dosya tek otorite dokümandır; her adım tamamlandıkça işaretlenecek ve yeni dosyalar eklenip güncellenecektir.

---

## Sprint 1 — Çalışır Demo İskeleti (Backend + n8n + Temel UI Okuma)

Kapsam: DB şeması + RLS; Webhook ingest API iskeletleri; n8n akışları (reply & booking ingest); UI: Pipeline Kanban (read-only) + Deal Detail (read), Activity Timeline (read).

### 1) Supabase/Postgres Şeması
- [x] sql/001_crm_schema.sql
  - [x] tables: contacts, companies, deals, pipelines, pipeline_stages, activities, owners
  - [x] seed: pipelines + pipeline_stages (Default: New, Contacted, Qualified, Meeting Scheduled, Proposal Sent, Won, Lost)
  - [x] indexes: fk’ler + lookup için gerekli composite index’ler (örn: deals(pipeline_id, stage_id))
- [x] sql/002_policies.sql
  - [x] RLS aç/kapat, row-level politikalar (owner_id bazlı)
  - [x] read/write ayrımı, service role için geniş yetki, client için sınırlı
- [x] sql/003_seed.sql
  - [x] örnek pipeline, örnek stage’ler, örnek owner, 2-3 örnek contact/company/deal

### 2) API/Edge Functions İskeleti (TypeScript)
- [x] functions/crm-webhooks/instantly-reply
  - [x] POST /crm/webhooks/instantly/reply
  - [x] Signature doğrulama (HMAC) iskeleti (dev bypass opsiyonu)
  - [x] Payload normalize + idempotency_key kontrolü (webhooks_log)
  - [x] Upsert contact + activities.insert(type=email_in) + AI intent (mock)
- [x] functions/crm-webhooks/calcom-booking
  - [x] POST /crm/webhooks/calcom/booking
  - [x] Booking payload parse + ilgili contact/deal bulma + deals.stage=Meeting Scheduled + activities.insert(type=meeting)
- [x] functions/crm-actions
  - [x] POST /crm/actions/deals (create/update basit)
  - [x] POST /crm/actions/deals/:id/stage (stage update + system activity + outbound log kaydı)
  - [x] POST /crm/actions/contacts (create/update basit)

### 3) n8n İş Akışları (JSON)
- [x] workflows/instantly_reply_ingest_workflow.json (Taslak tamam; uçtan uca test, CRM yayın sonrası)
  - [x] Webhook in -> Normalize -> Edge’e POST (Idempotency-Key header) -> 200/409 path iskeleti
  - [ ] Uçtan uca 200/409 testi (n8n→Edge): CRM ilk yayınından sonra tamamlanacak (ilk sürümde n8n proxy devre dışı kalabilir)
- [x] workflows/calcom_booking_ingest_workflow.json (Geçici entegrasyon: Baserow insert)
  - [x] Webhook in -> Parse/Normalize -> Baserow Insert (idempotency geçici olarak kapalı) -> Respond OK
  - [ ] S2’de Edge Function’a dönüş + Postgres idempotency (webhooks_log + unique index) + 200/409 test
- [x] workflows/crm_stage_change_outbound.json (Log-only doğrulandı)
  - [x] CRM’den gelen stage change webhook -> X-CRM-Secret doğrulama -> log-only -> 200 OK
  - [ ] S2: not_interested -> Instantly remove-from-campaign entegrasyonu

### 4) UI İskeleti (Embedlenebilir Panel)
- [x] web/app/crm/
  - [x] components/Kanban.tsx (read-only, Supabase’dan liste çekmeye hazır; şu an mock veri servisinden)
  - [x] components/DealDetail.tsx (deal alanları read)
  - [x] components/ActivityTimeline.tsx (timeline read)
  - [x] components/ContactQuick.tsx (contact kısa görünüm read)
- [x] web/app/services/crmApi.ts
  - [x] fetch helpers (mock veri ile MVP; Supabase/Proxy entegrasyonu sonraki adım)
- [x] web/app/crm/page.tsx
  - [x] Kanban ana görünüm (read-only, mock veri ile) — route: /crm
- [x] web/app/crm/deal/[id]/page.tsx
  - [x] Deal detail + timeline + contact quick (read; mock veri ile) — route: /crm/deal/[id]

Not: UI mock veri ile çalışır. Geliştirme sunucusu 3001 portunda çalıştırılarak doğrulandı (EADDRINUSE nedeniyle 3000 yerine 3001). Doğru rotalar: /crm ve /crm/deal/[id].

### 5) Dokümantasyon
- [x] docs/crm_api.md
  - [x] endpoints: webhooks, actions; auth, signature, idempotency
- [x] docs/crm_webhooks.md
  - [x] payload örnekleri (Instantly reply, cal.com booking)
- [x] docs/crm_ui.md
  - [x] embed yönergeleri, route yapısı, auth beklentileri
- [x] docs/STEP2_edge_functions_plan.md
- [x] docs/STEP2_edge_functions_progress.md
- [x] docs/STEP1_database_and_docs.md
- [x] docs/STEP4_ui_skeleton_plan.md (yeni)
- [x] docs/STEP4_tasks.md (yeni)

---

## Sprint 2 — Inline Edit, Aksiyonlar, Raporlama MVP

Kapsam: UI aksiyonları, stage drag & drop -> webhook, Instantly remove-from-campaign, AI intent görselleştirme, signature/idempotency tamamlanması.

### 1) UI Geliştirmeleri
- [x] Kanban drag & drop (stage change)
  - [x] Drag -> optimistic UI -> POST /crm/actions/deals/:id/stage (UI tarafı mock/real servis entegrasyonu hazır; Edge’e geçiş opsiyonel)
  - [ ] Outbound webhook: deal_stage_changed
- [ ] DealDetail inline edit
  - [ ] title, amount, close_date, stage hızlı güncelleme
- [ ] ContactQuick aksiyonları
  - [ ] Mark not_interested / interested
  - [ ] Send calendar link (cal.com) – S2’de buton, S3’te mesaj otomasyonu
- [ ] ActivityTimeline
  - [ ] AI intent sonuçlarını badge olarak göster (interested, not_interested, question)

### 2) n8n ve Otomasyonlar
- [ ] crm_stage_change_outbound.json
  - [ ] not_interested -> Instantly remove lead from campaign
- [ ] enrichment_update_workflow.json
  - [ ] Enrichment tamamlandığında company/contact update + activity
- [ ] instantly_reply_ingest_workflow.json
  - [ ] Mock AI yerine gerçek AI çağrısı (OpenAI/Bedrock vb.) + retry/hata yönetimi

### 3) Güvenlik & Dayanıklılık
- [x] Webhook signature validation (HMAC) yeniden test edildi (Instantly Reply, dev_server.ts ile 200/409 yönergesi hazır)
- [ ] Idempotency anahtarı ile tekrar çağrılarda güvenli işleme
- [ ] RLS testleri ve rol ayrımları
- [ ] Logging ve temel observability

### 4) Raporlama MVP
- [x] Pipeline conversion (stage-to-stage) — snapshot panel (UI’da)
- [x] Açık fırsat sayısı, Son 7 gün reply sayısı — snapshot paneller (UI’da)

---

## Veri Modeli (Özet)

- contacts(id, email, full_name, title, linkedin_url, website, phone, company_id, owner_id, lifecycle_stage, reply_status, reply_summary, generated_body_step1, generated_body_step2, generated_body_step3, latest_email_sent_at, created_at, updated_at)
- companies(id, name, domain, location, size, industry, website, linkedin, enrichment_json, created_at, updated_at)
- deals(id, title, contact_id, company_id, pipeline_id, stage_id, amount, currency, close_date, status, source, notes, created_at, updated_at)
- pipelines(id, name, is_default)
- pipeline_stages(id, pipeline_id, name, order_index, probability)
- activities(id, type, related_type, related_id, content, meta_json, created_by, created_at)
- owners(id, name, email, role)
- webhooks_log(id, source, event_type, payload_json, processed_at, status)

---

## API Sözleşmeleri (MVP)

Inbound:
- POST /crm/webhooks/instantly/reply
  - body: instantly payload
  - işlem: upsert contact, activities.add(email_in), contacts.reply_* alanlarını güncelle, gerekiyorsa deal oluştur/qualify
- POST /crm/webhooks/calcom/booking
  - body: booking payload
  - işlem: ilgili contact/deal bul, deals.stage=Meeting Scheduled, activity ekle

Actions:
- POST /crm/actions/deals
- POST /crm/actions/deals/:id/stage
- POST /crm/actions/contacts

Outbound:
- deal_stage_changed
- contact_status_changed
- activity_logged

Genel ilkeler:
- Authorization: JWT (Supabase Auth)
- Signature: HMAC-SHA256 (webhook doğrulama)
- Idempotency: idempotency_key header/body
- Timestamps: occurred_at ISO

---

## Geliştirme Notları ve Kararlar

- AI intent: S1’de mock, S2’de gerçek LLM; prompt ve output schema JSON.
- Instantly API: remove-from-campaign S2’de entegre edilecek.
- cal.com: booking link dağıtımı S2 UI, S3 otomasyonla e-posta gönderimi.
- Enrichment: BrightData/Apify sonuçları activities ve enrichment_json alanlarına yansıtılacak.
- Embed: Aynı origin altında route /app/crm önerilir; gerekiyorsa iFrame + postMessage.

---

## STEP Durumları

- [x] STEP 1 — Database & Documentation (docs/STEP1_database_and_docs.md)
- [x] STEP 2 — Edge Functions (Deno) — PLAN ve İlerleme (docs/STEP2_edge_functions_plan.md, docs/STEP2_edge_functions_progress.md)
- [x] STEP 2 — Edge Functions (Deno) — Tamamlama (kapanış ölçütleri: docs/STAGING_ROLLOUT.md — staging’de 002_policies rollout + app_user ile gerçek HMAC açıkken 200/409 testi; eksik GRANT’ler idempotent eklenir; ardından crm.md güncellenir)
- [x] STEP 3 — n8n İş Akışları (Taslaklar) — Taslaklar hazır; Instantly uçtan uca test yayın sonrasına ertelendi (detay: docs/STEP3_n8n_workflows_plan.md)
- [x] STEP 4 — UI İskeleti (Read-Only)

---

## Sonraki Adım (Bu repo içinde üretilecek/güncellenecek dosyalar)

1) workflows/instantly_reply_ingest_workflow.json — uçtan uca test CRM yayını sonrası (n8n→Edge 200/409)
2) workflows/calcom_booking_ingest_workflow.json — S2’de Edge Function’a dönüş + Postgres idempotency
3) workflows/crm_stage_change_outbound.json — S2’de not_interested → Instantly remove-from-campaign
4) web/app/crm/ (component ve sayfa iskeletleri) — oluşturuldu (read-only mock ile)
5) web/app/services/crmApi.ts — Edge Actions entegrasyonu eklendi (mock fallback’lı), raporlama snapshot yardımcıları ile güncellendi
6) docs/STAGING_ROLLOUT.md (hazır) + HMAC test yönergesinin “dev_server.ts” ile tekrar çalıştırılması doğrulandı
7) scripts/regression_tests/instant_reply.ps1 ve scripts/regression_tests/instant_reply.sh (hazır)

Notlar:
- STEP 2 — Tamamlama kapanış ölçütleri: docs/STAGING_ROLLOUT.md’deki plana göre staging’de 002_policies.sql rollout, Deno env’de PG_USER=app_user ve DEV_SIGNATURE_BYPASS=false ile Instantly Reply 200/409 testi. Gerekli ilave GRANT’ler idempotent şekilde crm/sql/002_policies.sql’e eklendi.
- EDGE Actions entegrasyonu: UI servisleri (updateDeal, updateDealStage, updateContactStatus) gerçek uçlara bağlandı; NEXT_PUBLIC_CRM_API_BASE set edildiğinde Edge’e çağrı, aksi halde mock fallback.
- STEP 3 — İlk yayın kapsamı: Instantly uçtan uca test yayın sonrasına ertelendi; cal.com geçici Baserow entegrasyonu ile çalışır; stage change outbound log-only doğrulandı.
