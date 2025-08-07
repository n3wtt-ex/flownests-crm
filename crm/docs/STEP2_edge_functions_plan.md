# STEP 2 — API (Node/Deno) + PostgreSQL Plan

Durum: KISMEN TAMAMLANDI (Dev doğrulama başarılı; gerçek DB+HMAC finalize edilecek)
Seçilen mimari: API Katmanı (Node.js/Deno, self-hosted) + PostgreSQL
Not: Supabase dönüş dokümanı opsiyonel referans olarak korunur; mevcut dağıtım Supabase’e bağlı değildir (Postgres-only).

Bu adımda inbound webhook’ları ve CRM aksiyon endpoint’lerini kendi API katmanınız (Node.js/Deno) üzerinde iskelet halinde kuracağız. Amaç Sprint 1 kapsamında “çalışır demo” için gerekli en temel uçları hazır etmek ve n8n ile güvenli iletişimin temelini atmak. Supabase bağımlılığı yoktur.

---

## Dosya/Dizin Yapısı (öneri)

functions/
  crm-webhooks/
    instantly-reply/
      index.ts
      _utils.ts
      _types.ts
      README.md
    calcom-booking/
      index.ts
      _utils.ts
      _types.ts
      README.md
  crm-actions/
    index.ts
    _utils.ts
    _types.ts
    README.md

env/
  edge/.env.example

docs/
  STEP2_edge_functions_plan.md (bu dosya)

---

## Ortak İlkeler

- Runtime: Node.js (Express/Fastify) veya Deno (self-hosted)
- DB Client: node-postgres (pg) / Prisma / deno_postgres (seçime göre, PG_* env ile bağlanır)
- Auth:
  - Public inbound webhook uçları (Instantly/cal.com): HMAC Signature doğrulaması (prod).
  - CRM actions uçları: Bearer JWT (RLS OFF → uygulama seviyesinde owner_id kontrolü).
- Idempotency:
  - Header: Idempotency-Key (varsa); yoksa payload’taki idempotency_key alanı.
  - webhooks_log tablosu üzerinden duplicate engelleme.
- Observability:
  - webhooks_log.status: received -> processed | error
  - Hatalarda anlamlı HTTP kodları (400/401/409/500)

---

## Endpoints

1) POST /crm/webhooks/instantly/reply (API Katmanı)
- Görev: Instantly reply webhook ingest
- Adımlar:
  1. Signature doğrulama (dev: opsiyonel bypass)
  2. webhooks_log insert(received)
  3. Contact upsert(email)
  4. Activity insert(type=email_in)
  5. Mock AI intent: contacts.reply_status/summary set
  6. Interested ise açık deal yoksa -> deals.create + stage=Qualified
  7. webhooks_log processed

2) POST /crm/webhooks/calcom/booking (API Katmanı)
- Görev: Booking ingest
- Adımlar:
  1. Signature doğrulama (dev bypass opsiyonu)
  2. webhooks_log insert(received)
  3. Attendee email -> contact/deal bul
  4. deals.stage = Meeting Scheduled
  5. activity insert(type=meeting)
  6. webhooks_log processed

3) POST /crm/actions/deals (API Katmanı)
- Görev: Deal create/update
- Auth: Bearer JWT (RLS OFF → app-level owner_id doğrulaması)
- Body: create or update fields (docs/crm_api.md)

4) POST /crm/actions/deals/:id/stage (API Katmanı)
- Görev: Stage değişimi (Kanban DnD)
- Auth: Bearer JWT (RLS OFF → app-level owner_id doğrulaması)
- Aşamalar: doğrula -> stage güncelle -> activity(system) -> (S1’de outbound log, S2’de gerçek webhook)

5) POST /crm/actions/contacts (API Katmanı)
- Görev: Contact create/update
- Auth: Bearer JWT (RLS OFF → app-level owner_id doğrulaması)

---

## Konfigürasyon (env)

API + PostgreSQL (self-hosted)
- PG_HOST=...
- PG_PORT=5432
- PG_DATABASE=crm
- PG_USER=app_user
- PG_PASSWORD=********
- LOG_LEVEL=info
- DEV_SIGNATURE_BYPASS=false
- HMAC_SHARED_SECRET_INSTANTLY=...
- HMAC_SHARED_SECRET_CALCOM=... (varsa)
- JWT_SECRET=... (actions için)

Opsiyonel (Supabase dönüş notu)
- SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY yalnız dönüş senaryosu için referans olarak kalır; mevcut dağıtımda gerekmiyor.

---

## Tipler (örnek)

- _types.ts
  - InstantlyReplyPayload
  - CalcomBookingPayload
  - ApiResponseOk / ApiResponseError
  - CRM entity id tipleri

---

## Yardımcılar (_utils.ts)

- parseJson(request: Request): Promise<{ raw: string; json: any }>
- verifyHmacSignature(raw: string, header: string, secret: string): boolean
- getIdempotencyKey(headers, json): string
- upsertContactByEmail(...)
- insertActivity(...)
- findOrCreateDealForContact(...)
- updateDealStage(...)
- logWebhook(...)

---

## MVP İskelet Tamamlama Kriterleri

- Tüm index.ts dosyaları endpoint’i açmalı, minimal iş akışı çalışmalı (mock intent).
- Hata durumları anlamlı HTTP kodlarıyla dönmeli.
- webhooks_log kayıtları yazılmalı ve processed-atayabilmeli.
- README.md’ler hızlı kurulum talimatı içermeli (API katmanı deploy/test).

Durum Notu (08-05-2025):
- Instantly Reply (Step E) akışı Deno ile lokal çalıştırılarak 200/409 idempotency ile doğrulandı (Postgres şeması ile uyumlu).
- Mevcut doğrulama HMAC (Instantly secret) ile sınırlı; JWT ileride eklenecek.
- “Tamamlama” için plan: staging’de 002_policies rollout, DEV_SIGNATURE_BYPASS=false ve gerçek HMAC ile 200/409’u geçmek; akabinde crm.md’de “STEP 2 — Tamamlama” işaretlenecek.

---

## Sonraki Adım

Kısa vadede (STEP 2 — Tamamlama):
- dev short-circuit’ı kaldır
- gerçek DB yazımını (contacts/activities/deals/webhooks_log) canlı doğrula
- HMAC imza doğrulamasını gerçek X-Signature ile test et
- docs/STEP2_edge_functions_progress.md ve crm.md güncelle (API Katmanı + PostgreSQL olarak)

Orta vadede:
- n8n taslakları (STEP 3) ve UI iskeleti (STEP 4)

Plan onayı ardından bu adımlar tamamlandıkça “Tamamlandı” olarak işaretlenecektir.
