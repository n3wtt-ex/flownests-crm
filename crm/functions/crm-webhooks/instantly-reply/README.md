# Instantly Reply — Supabase Edge Function

Endpoint: POST /crm/webhooks/instantly/reply

Amaç: Instantly reply webhook’larını alır, contact upsert eder, activity (email_in) ekler, mock intent ile contact.reply_status/summary günceller, gerekirse deal oluşturur (Qualified).

Notlar:
- Deno runtime içindir (Supabase Edge). VSCode’da TypeScript hataları görünebilir; bu hatalar lokal editördendir. Supabase CLI ile deploy edildiğinde Deno ortamı doğru tipleri sağlar.
- HMAC İmzası: `X-Signature: sha256=HEX`. Dev modda `DEV_SIGNATURE_BYPASS=true` ile doğrulama bypass edilebilir.

## Çevresel değişkenler (env/edge/.env.example)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
HMAC_SHARED_SECRET_INSTANTLY=...
DEV_SIGNATURE_BYPASS=false
```

## Yerel test (Supabase CLI)

1) Supabase CLI ile functions klasöründen çalışın:
```
supabase functions serve --env-file env/edge/.env.example
```

2) Örnek çağrı (signature bypass açıkken):
```
curl -X POST http://localhost:54321/functions/v1/crm-webhooks--instantly-reply \
  -H "Content-Type: application/json" \
  -d '{
    "event": "reply",
    "campaign_id": "cmp_123",
    "lead": { "email": "john@acme.com", "full_name": "John Doe", "linkedin_url": "https://www.linkedin.com/in/john" },
    "message": { "subject": "Re: Hello", "text": "Hi, pricing?", "received_at": "2025-08-04T15:35:22.000Z" },
    "idempotency_key": "evt_abc_123"
  }'
```

3) İmza doğrulaması açıldığında HMAC hesaplayıp `X-Signature` header’ı gönderin:
```
X-Signature: sha256=<hex_digest_of_body_with_secret>
```

## VSCode Tip Hataları Hakkında

- `Cannot find name 'Deno'`: Deno tipi runtime’da mevcuttur. Editör uyarısı için dosyada `declare const Deno ...` ile tip bildirimi eklenmiştir.
- `Cannot find module 'https://esm.sh/@supabase/supabase-js@2'`: Deno, URL importlarını destekler. Lokal tip çözümleyici uyarı verebilir; deploy ve runtime’da problem yoktur.

## Akış Özeti

1. JSON ham gövde okunur (HMAC için ham metin gerekir).
2. (Opsiyonel) X-Signature HMAC doğrulanır.
3. webhooks_log(status=received) kaydı atılır (idempotency_key ile).
4. contacts upsert(email).
5. activities insert(type=email_in).
6. Mock intent: reply_status & reply_summary update.
7. Interested ise: açık deal yoksa yeni deal -> stage=Qualified, system activity eklenir.
8. webhooks_log(status=processed) güncellenir.
