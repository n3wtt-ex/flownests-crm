# CRM API Sözleşmeleri (MVP)

Bu doküman, CRM modülü için inbound webhooks ve aksiyon (actions) endpoint'lerinin sözleşmelerini, güvenlik ilkelerini ve idempotency kurallarını tanımlar. Uygulama hedefi Supabase Edge Functions (TypeScript) veya eşdeğer bir Node.js API katmanıdır.

Versiyon: v0 (MVP)
Durum: Taslak (Sprint 1 kapsamında uygulanacak)

---

## Güvenlik

- Authorization: JWT (Supabase Auth). Client tarafı çağrılarında bearer token beklenir.
- Webhook Signature: HMAC-SHA256 ile imzalı inbound webhook’lar (Instantly, cal.com).
  - Header: `X-Signature` (örn. `sha256=hex` formatı).
  - Sunucu tarafında `SHARED_SECRET` ile gövde üzerine imza doğrulanır.
- Idempotency:
  - Header: `Idempotency-Key` (opsiyonel fakat önerilir).
  - Aynı idempotency anahtarına sahip tekrar denemeler “safe” şekilde ele alınır.
  - İşlenen event’ler `webhooks_log(idempotency_key)` üzerinden izlenebilir.
- Timestamps:
  - Tüm event’lerde `occurred_at` (ISO datetime) alanı tercih edilir; yoksa `created_at` veya sunucu zamanı kullanılır.

---

## Inbound Webhooks

### 1) POST /crm/webhooks/instantly/reply

Instantly.io Reply Webhook’undan gelen e-postaları karşılar ve CRM’e işler.

- Auth: HMAC-SHA256 `X-Signature` zorunlu (MVP’de iskelet + opsiyonel doğrulama).
- Body (örnek, gerçek payload Instantly.io dokümantasyonuna göre farklılık gösterebilir):

```json
{
  "event": "reply",
  "campaign_id": "cmp_123",
  "lead": {
    "email": "john@acme.com",
    "full_name": "John Doe",
    "company": "Acme Inc.",
    "linkedin_url": "https://www.linkedin.com/in/john-doe"
  },
  "message": {
    "subject": "Re: Quick question",
    "snippet": "Sounds interesting, can you share pricing?",
    "text": "Hi, sounds interesting. Can you share pricing and case studies?",
    "received_at": "2025-08-04T15:35:22.000Z"
  },
  "idempotency_key": "evt_abc_123"
}
```

- İş akışı:
  1. Signature doğrula (varsa).
  2. `webhooks_log` kaydı oluştur (status=received).
  3. Contact upsert (email üzerinden).
  4. Activity ekle: `type="email_in"`, `related_type="contact"`, meta olarak kampanya/id’ler.
  5. AI intent (Sprint 1’de mock): `reply_status` ve `reply_summary` alanlarını güncelle.
  6. Eğer contact “interested” ise ve açık deal yoksa yeni deal oluştur + `stage=Qualified`.
  7. `webhooks_log.status="processed"` ve `processed_at` set edilir.

- Response:
  - 200 OK
  - Body:
    ```json
    { "status": "ok", "contact_id": "uuid", "deal_id": "uuid_or_null" }
    ```

- Hata Durumları:
  - 400 (Invalid payload), 401 (Invalid signature), 409 (Idempotent duplicate), 500 (Internal)

---

### 2) POST /crm/webhooks/calcom/booking

cal.com’dan gelen booking webhook’larını işler.

- Auth: HMAC-SHA256 `X-Signature` (MVP’de iskelet).
- Body (örnekleştirilmiş):

```json
{
  "event": "booking.created",
  "booking": {
    "id": "bk_123",
    "title": "Discovery Call",
    "start_time": "2025-08-05T10:00:00.000Z",
    "end_time": "2025-08-05T10:30:00.000Z",
    "attendees": [
      { "email": "john@acme.com", "name": "John Doe" }
    ],
    "metadata": { "pipeline": "Default Sales" }
  },
  "idempotency_key": "cal_evt_456"
}
```

- İş akışı:
  1. Signature doğrula.
  2. `webhooks_log` kaydı (received).
  3. Attendee email ile contact/deal ilişkilendirmesi yap.
  4. Deal stage: `Meeting Scheduled` (varsa güncelle, yoksa oluşturma politikası opsiyonel).
  5. Activity ekle: `type="meeting"`, content’te özet ve zaman bilgileri.
  6. `webhooks_log.status="processed"`.

- Response:
  - 200 OK
  - Body:
    ```json
    { "status": "ok", "contact_id": "uuid", "deal_id": "uuid" }
    ```

---

## Actions (CRM içi mutasyon endpoint’leri)

Tüm actions endpoint’leri JWT ile korunur ve RLS politikaları ile sınırlanır. Service role ile backend’den çağrılabilir.

### 3) POST /crm/actions/deals

Deal oluşturma/güncelleme.

- Auth: Bearer JWT
- Body (Create örneği):
```json
{
  "title": "Acme - Pilot",
  "contact_id": "uuid-or-null",
  "company_id": "uuid-or-null",
  "pipeline_id": "uuid",
  "stage_id": "uuid",
  "amount": 2500,
  "currency": "USD",
  "close_date": "2025-08-30",
  "source": "inbound",
  "notes": "High potential"
}
```

- Body (Update örneği):
```json
{
  "id": "deal-uuid",
  "title": "Acme - Pilot (Rev)",
  "stage_id": "stage-uuid",
  "notes": "updated"
}
```

- Response:
```json
{ "status": "ok", "id": "deal-uuid" }
```

- Hatalar: 400 (validation), 403 (RLS), 404 (not found), 500

---

### 4) POST /crm/actions/deals/:id/stage

Deal stage değişimi (Kanban drag & drop sonrası).

- Auth: Bearer JWT
- Params: `id` (deal uuid)
- Body:
```json
{
  "stage_id": "uuid",
  "occurred_at": "2025-08-04T18:43:00.000Z",
  "idempotency_key": "move_001"
}
```

- İş akışı:
  1. Deal’ı doğrula (RLS).
  2. Stage değiştir.
  3. Outbound webhook tetikle: `deal_stage_changed` (Sprint 1: log; Sprint 2: gerçek event).
  4. Activity: `type="system"`, content’te eski->yeni stage.

- Response:
```json
{ "status": "ok", "id": "deal-uuid", "stage_id": "uuid" }
```

---

### 5) POST /crm/actions/contacts

Contact oluşturma/güncelleme.

- Auth: Bearer JWT
- Body (Create):
```json
{
  "email": "john@acme.com",
  "full_name": "John Doe",
  "title": "VP Sales",
  "company_id": "uuid",
  "owner_id": "uuid",
  "lifecycle_stage": "lead"
}
```

- Body (Update):
```json
{
  "id": "contact-uuid",
  "full_name": "Johnathan Doe",
  "reply_status": "interested",
  "reply_summary": "Asked for pricing and ROI"
}
```

- Response:
```json
{ "status": "ok", "id": "contact-uuid" }
```

---

## Outbound Webhooks (CRM -> n8n)

MVP’de log yazımı; Sprint 2’de gerçek webhook gönderimi.

### Event: deal_stage_changed
- Body:
```json
{
  "id": "event-uuid",
  "type": "deal_stage_changed",
  "deal_id": "uuid",
  "old_stage_id": "uuid",
  "new_stage_id": "uuid",
  "occurred_at": "2025-08-04T18:43:00.000Z",
  "source": "crm-ui",
  "idempotency_key": "move_001"
}
```

### Event: contact_status_changed
- Body:
```json
{
  "id": "event-uuid",
  "type": "contact_status_changed",
  "contact_id": "uuid",
  "old_status": "not_interested",
  "new_status": "interested",
  "occurred_at": "2025-08-04T18:50:00.000Z",
  "source": "crm-ui"
}
```

### Event: activity_logged
- Body:
```json
{
  "id": "event-uuid",
  "type": "activity_logged",
  "activity_id": "uuid",
  "related_type": "deal",
  "related_id": "uuid",
  "occurred_at": "2025-08-04T18:52:00.000Z",
  "source": "system"
}
```

---

## Hata Kodları ve Yanıtlar

- 200 OK: Başarılı işlem.
- 202 Accepted: İşlem kuyruğa alındı (ilerideki sürüm).
- 400 Bad Request: Şema/validation hatası.
- 401 Unauthorized: Token veya imza hatası.
- 403 Forbidden: RLS/rol engeli.
- 404 Not Found: İlişkili kayıt yok.
- 409 Conflict: Idempotency/duplicate.
- 422 Unprocessable Entity: İş kuralları çakıştı.
- 500 Internal Server Error.

---

## Notlar

- Sprint 1’de AI intent “mock” olacak; Sprint 2’de gerçek LLM çağrısı ve hata yönetimi eklenecek.
- Instantly “remove-from-campaign” Sprint 2’de `crm_stage_change_outbound.json` ile bağlanacak.
- cal.com booking sonrası stage güncellemesi bu endpoint ile tamamlanır ve activity’ye loglanır.
