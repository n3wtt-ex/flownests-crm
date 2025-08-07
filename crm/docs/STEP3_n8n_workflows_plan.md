# STEP 3 — n8n İş Akışları (Taslaklar) Planı

Durum: KISMEN TAMAMLANDI (canlı testler geçti). Taslaklar oluşturuldu; cal.com için Baserow’a geçici kayıt akışı çalışır; crm_stage_change_outbound akışı shared-secret ile 200 dönecek şekilde doğrulandı; idempotency geçici olarak devre dışı; tarih/email saha uyumu doğrulandı. Instantly Reply uçtan uca (n8n→Edge) entegrasyon testi, CRM ilk yayın sonrası yapılacaktır.
Kapsam: Sprint 1 kapsamında çalışır demo iskeleti için n8n tarafındaki üç temel workflow'un taslağı, güvenlik/idempotency ilkeleri, test senaryoları ve kapanış ölçütleri.

İlgili Dosyalar:
- crm/crm.md — Yol Haritası ve Görev Listesi
- crm/docs/crm_api.md — Inbound/Actions sözleşmeleri (HMAC, Idempotency)
- crm/docs/crm_webhooks.md — Instantly Reply akışı ve test komutları
- crm/docs/STEP2_edge_functions_plan.md, crm/docs/STEP2_edge_functions_progress.md — Edge Functions mimarisi/ilerleme
- crm/docs/PROD_READINESS.md — Rollout ve roller/izinler

Üretilecek/Tutulacak Workflow Dosyaları:
- crm/workflows/instantly_reply_ingest_workflow.json
- crm/workflows/calcom_booking_ingest_workflow.json
- crm/workflows/crm_stage_change_outbound.json

Geçici Entegrasyon (Sprint 1 kapanışı için):
- cal.com booking ingest akışında, Edge Function yerine Baserow’a kayıt (ok/log) yazma yolu aktiftir. Baserow alan eşlemesi sahada test edilmiştir.
- Idempotency kontrolü şu an kapalıdır (aynı anahtarla ikinci POST ikinci kayıt oluşturur). S2’de kalıcı idempotency, Postgres webhooks_log + unique index + upsert ile çözülecek; Baserow üzerinde ek “eşsiz”/temizlik adımları uygulanmayacaktır.
- Tarih alanları için “include time” açık format (ISO ‘Z’ sonlu) Baserow’da doğrulandı; milisaniyeler kaldırılarak “...Z” formatına normalize edildi.
- primary_email sütunu Baserow’da mevcut ve akışta dolduruluyor.
- crm_stage_change_outbound akışı için X-CRM-Secret doğrulaması Code node ile yapılmakta (sabit secret, S2’de env’e alınacak).

---

## Hedefler

- Inbound kaynaklardan gelen olayları normalize edip, ana iş mantığını Edge Functions (Deno) katmanında işleyecek şekilde n8n üzerinden güvenli, gözlemlenebilir, idempotent bir orkestrasyon sağlamak.
- MVP’de AI intent backend’de mock; outbound (deal stage changed) S1’de log-only.
- n8n, retry/backoff ve logging’i üstlenir; HMAC/idempotency’nin ana doğrulayıcısı backend’dir.

---

## Genel İlkeler

Güvenlik
- n8n inbound Webhook'ları iç ağda veya IP allowlist ile korunur.
- Push akışlarında CRM backend → n8n Webhook çağrılarında Shared Secret (örn. X-CRM-Secret) veya Basic Auth kullanılmalıdır.
- HMAC Signature doğrulaması (Instantly, cal.com) backend tarafında yapılır; n8n sadece raw body’yi proxy edecek şekilde kurgulanır (opsiyonel).

İdempotency
- Ana kontrol Edge Functions + Postgres `webhooks_log` tablosu üzerinden gerçekleştirilir.
- n8n, 409 Conflict’i “beklenen idempotent tekrar” olarak ele alır; 409 için retry yapmaz.

Retry/Backoff
- HTTP Request node’larında 5xx/429 için exponential backoff (ör: 1s, 5s, 20s) ve max 3 deneme.
- 4xx hatalarında (özellikle 409) retry yok.

Observability
- Her çağrıda `idempotency_key`, hedef URL, response code/body execution log’larına yazılır.
- Başarılı/başarısız dallar ayrı loglanır.

---

## Workflow 1: Instantly Reply Ingest
Dosya: crm/workflows/instantly_reply_ingest_workflow.json

Amaç
- Instantly’den gelen reply webhook’unu almak/normalize etmek ve Edge Function `/crm/webhooks/instantly/reply` endpoint’ine iletmek. Backend, contact upsert + activity + mock intent + deal (Qualified) işlemlerini yapar.
- Not: CRM ilk yayınında n8n→Edge proxy bağlantısı PROD’da aktif edilmeyecek; Instantly uçtan uca entegrasyon testi (200/409) “CRM yayınlandıktan sonra” tamamlanacaktır. İlk sürüm için bu bir engel teşkil etmez.

Önerilen Node Yapısı
1) Webhook (Trigger)
   - Method: POST
   - Path: /crm/n8n/instantly/reply
   - Raw body saklama: Açık (opsiyonel; HMAC backend’de)
2) Function (Normalize)
   - Girdi: payload
   - Çıkarımlar:
     - lead.email, lead.full_name
     - message.subject, message.text, occurred_at = message.received_at
     - campaign_id
     - idempotency_key (Header: Idempotency-Key veya body: idempotency_key)
   - Çıktı: backend sözleşmesiyle uyumlu JSON
3) HTTP Request (POST → Edge Function)
   - URL: {EDGE_BASE_URL}/crm/webhooks/instantly/reply
   - Headers:
     - Content-Type: application/json
     - Idempotency-Key: (varsa)
     - X-Signature: (prod’da backend tarafından doğrulanacak; n8n’de opsiyonel)
   - Retry: 5xx/429 için 3 deneme, exponential backoff
4) IF (Status=200)
   - Set vars: contact_id, deal_id, reply_status, reply_summary
   - Log success (idempotency_key, response kısaltılmış body)
5) IF (Status=409)
   - Log duplicate (idempotent)
6) Error branch
   - Log error (status/body)

Durum
- Taslak oluşturuldu ve node yapısı doğrulandı:
  - Webhook (POST /instantly-reply)
  - HTTP Request → {EDGE_BASE_URL}/crm/webhooks/instantly/reply
  - Opsiyonel Signature Check düğümü mevcut (Edge doğrulaması ana kaynak)
  - Mock Intent düğümü Edge arızası için fallback (Edge zaten intent yazıyor)
- Gerekli ENV/placeholder: EDGE_BASE_URL, (opsiyonel) FLOW_VERIFY_URL

Test Senaryosu
- scripts/regression_tests/instant_reply.ps1 içeriğine eşdeğer payload’la ilk POST → 200
- Aynı payload/idempotency_key ile tekrar → 409
- Log’larda idempotency_key ve response görülecek.
- Zamanlama: Uçtan uca (n8n→Edge) test CRM yayını sonrasında yapılacak; yayın öncesi yalnız normalize/şema doğrulamaları gerçekleştirildi.

---

## Workflow 2: cal.com Booking Ingest
Dosya: crm/workflows/calcom_booking_ingest_workflow.json

Amaç (Güncel)
- cal.com booking event’ini ingest edip normalize etmek ve GEÇİCİ OLARAK Baserow tabloya kayıt yazmak (Edge Function yerine). Sprint 2’de nihai hedef Edge Function’a yönlendirmek. Entegrasyon canlı testten geçti (200 OK ve satır oluşumu doğrulandı).

Güncel Node Yapısı (Uygulanan)
1) Webhook (Trigger)
   - Method: POST
   - Path: /crm/n8n/calcom/booking
2) Code: Parse + Normalize
   - Çıktı: normalized: { event, booking{ id,title,start_time,end_time,attendees,metadata }, idempotency_key, primary_email }
   - Idempotency-Key header veya body.idempotency_key desteklenir.
3) Code: Build Baserow Payload1
   - start_time/end_time alanları “2025-08-05T10:00:00.000Z” → “2025-08-05T10:00:00Z” olacak şekilde milisaniyesiz ISO’ya çevrilir (Baserow include time açık).
   - primary_email alanı set edilir (norm.primary_email || attendees[0].email).
   - Gönderilecek payload:
     {
       idempotency_key, event, booking_id, primary_email, title,
       start_time, end_time, pipeline, status: "ok",
       created_at: ISO, raw_json: stringified normalized
     }
4) Baserow: Create a row (n8n Baserow node)
   - databaseId=103, tableId=533
   - dataToSend=autoMapInputData (payload alan adları tablo sütun adlarıyla birebir)
   - Credentials: Baserow account (Authorization: Token …)
5) Respond OK
   - Baserow yanıtından dönen id/order vb. alanlar test çıktısında gözlenir.

Notlar:
- Idempotency şu an kapalı (aynı idempotency_key ile ikinci POST yeni satır olarak yazılır).
- Eğer Baserow’da status Single Select ise “ok” seçeneğinin tanımlı olduğundan emin olun. Text ise ek iş gerekmez.
- Baserow’a primary_email sütunu eklendi ve akışta doluyor.

Güncel Durum / En Son Test
- cal_evt_test_010 ile iki POST çalıştırıldı:
  - 1. POST → id: 8, start_time: 2025-08-05T10:00:00Z, end_time: 2025-08-05T10:30:00Z, primary_email: john@acme.com
  - 2. POST → id: 9, aynı payload (idempotency off)
- Baserow “include time” aktifken Z’li ISO formatı kabul ettiği doğrulandı.

Gerekli ENV/placeholder
- BASEROW_BASE=https://baserow.flownests.org
- BASEROW_TABLE_ID=533
- BASEROW_API_TOKEN=******** (n8n Credentials → Baserow account)
- (opsiyonel) NOTIFY_CHANNEL

Test Senaryosu (Güncel)
- scripts/regression_tests/calcom_booking_test.ps1 ile POST → 200 OK ve Baserow’da satır oluşur.
- Aynı idempotency_key ile tekrar POST → ikinci satır eklenir (bilinçli olarak).

Kısa Yol Haritası (Workflow 2 için)
- S2 (hedef): Edge Function’a dönüş; Postgres webhooks_log + unique index ile idempotent tasarım (200/409).
- Not: Baserow tarafında “eşsiz olmayanlarla uğraşma/temizlik” planı iptal edildi; idempotency kalıcı çözümü Postgres üzerinde sağlanacak.
- Instantly ile benzer şekilde, cal.com uçtan uca entegrasyonun prod aktif edilmesi CRM yayınından sonra planlanacaktır.

---

## Workflow 3: CRM Stage Change Outbound
Dosya: crm/workflows/crm_stage_change_outbound.json

Amaç
- CRM UI’de stage değişimi sonrası outbound event’i almak ve Sprint 1’de log-only olarak işlemek (200 OK yanıtı verilecek şekilde).
- Sprint 2’de `not_interested` durumunda Instantly remove-from-campaign çağrısı eklenecek.

Veri Akışı ve Güvenlik
- Push tercih edilir: CRM backend, stage değişimi sonrası n8n’in Webhook’unu çağırır.
- Webhook güvenliği: X-CRM-Secret (S1’de sabit değer; S2’de env’e taşınacak) veya alternatif olarak Basic Auth.

Güncel Node Yapısı (Uygulanan ve Test Edilen)
1) Webhook (Trigger)
   - Method: POST
   - Path: /crm/n8n/deal_stage_changed
   - Security: X-CRM-Secret header (sabit değerle doğrulama — Verify Secret Header)
2) Code: Verify Secret Header (reserved-key-safe)
   - Input: $json.headers
   - Logic: lowercase header anahtarları; norm["x-crm-secret"] == expected?
   - Output: { result: { authorized: true|false, status, reason? } }
3) IF Authorized?
   - Koşul: ={{$json.result?.authorized === true}}
   - True: Extract Payload → Switch → Logger → Respond 200
   - False: Respond akışına gitmez (401/403 davranışı, debug/log)
4) Code: Extract Payload
   - Body’den şu alanları çıkarır: deal_id, old_stage_id, new_stage_id, occurred_at, source (camelCase/snake_case toleranslı)
5) Switch: Not Interested?
   - Değer: ={{$json.new_stage_id || ''}}
   - Kurallar: contains “not_interested” → output 1; contains “NOT_INTERESTED” → output 1
   - Fallback: default → Logger
6) Logger: Sadece log
7) Respond 200: { status: "received", deal_id, new_stage_id }

Canlı Test Sonucu
- Execution #495: success
  - Verify Secret → authorized=true
  - IF → true dalı
  - Extract Payload → success (test payloadında alanlar null olsa da akış sonlandı)
  - Logger → “Stage change logged for deal null -> null”
  - Respond 200 → 200 OK

Not:
- S1’de sabit secret kullanıldı (plan yükseltmeden env kullanımı mümkün olmadığından). S2’de env tabanlı hale getirilecek.

Gerekli ENV/placeholder
- (S2) INSTANTLY_API_BASE
- (S2) CRM_OUTBOUND_SECRET (env’e taşınması)

---

## Kapanış Ölçütleri (STEP 3)

- [x] instantly_reply_ingest_workflow.json
  - [x] Webhook → Normalize → POST Edge → 200/409 path’ları için iskelet hazır
  - [x] Retry/backoff ve logging stratejisi planlandı; ENV placeholder’ları eklendi
  - [x] HTTP Request node’u retry/backoff (maxRetries=3, timeout=30s) ve Idempotency-Key header’ı ile güncellendi
  - [ ] Uçtan uca test (n8n→Edge, 200/409): CRM yayını sonrasında tamamlanacak (ilk sürümde n8n proxy kapalı kalabilir)
  - [ ] Retry/backoff ve logging etkin (canlı test)

- [x] calcom_booking_ingest_workflow.json
  - [x] Webhook → Normalize → Build Payload (ms trim) → Baserow Create → Respond OK (geçici) çalışır iskelet (canlı test)
  - [x] Baserow alan eşlemesi net: idempotency_key, event, booking_id, primary_email, title, start_time (ISO Z, no ms), end_time (ISO Z, no ms), pipeline, status, created_at, raw_json
  - [x] Baserow node “Baserow account” credential (Authorization: Token …) ile yapılandırıldı
  - [ ] Idempotency kontrolü (Baserow lookup) (S2 hedef)
  - [ ] Edge Function’a dönüş (S2 hedef) ve 200/409 testi

- [x] crm_stage_change_outbound.json
  - [x] Webhook → log-only (S1) iskeleti hazır
  - [x] Güvenlik: X-CRM-Secret header doğrulaması eklendi (S1: sabit secret; S2: env)
  - [x] Webhook → log-only (S1) akışı test edildi (Execution #495 success)
  - [ ] S2: not_interested → Instantly remove-from-campaign (gerçek entegrasyon)

- [x] Dokümantasyon bu dosyada güncellendi; crm/crm.md içinde STEP 3 “Taslaklar” maddesi bu plana referans verecek şekilde işaretlenmeye hazır.

---

## Zamanlama (Sprint 1 içinde — revize)

- Gün 1-2: Instantly Reply Ingest taslak + 200/409 testi
- Gün 3: cal.com Booking Ingest taslak + Baserow Insert (geçici) çalıştırma
- Gün 4: Stage Change Outbound log-only + backend push prova
- Gün 5: Smoke test ve log doğrulamaları, crm/crm.md güncellemesi için kanıt seti
- Not: Edge Function’a geri dönüş ve idempotency’nin kalıcı çözümü Sprint 2’ye aktarılmıştır.
- Ek: Stage Change Outbound için canlı test (ID #495) başarıyla tamamlandı.
- Ek-2: “Baserow üzerinde eşsiz kayıt politikası/temizlik” çalışmaları bırakıldı; kalıcı çözüm Postgres üzerinde uygulanacaktır.

---

## Riskler ve Bağımlılıklar

- Edge Functions erişimi ve HMAC doğrulama konfigürasyonu (S2’de geri dönüş planı).
- Baserow API erişimi ve rate-limit; credential yönetiminin güvenli yapılması.
- Idempotency: Geçici çözümde devre dışı; S2’de Postgres webhooks_log + unique index + upsert ile kalıcı kontrol sağlanacak.
- Baserow sütun tipleri: Date vs DateTime/Single Select seçenekleri (ör. status) — tip değişince akış mapping’i etkileyebilir.
- n8n’in dış uçlara erişimi (network/policy).
- Outbound gerçek aksiyon (Instantly) S2’ye planlı; S1’de yalnız log.
- Güvenlik: S1’de sabit X-CRM-Secret kullanımı; S2’de env/secrets yönetimine taşınacak.
