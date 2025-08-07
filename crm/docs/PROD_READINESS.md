# Production Readiness Guide

Bu doküman, CRM’in üretim ortamına güvenli ve kontrollü geçişi için rol/izin modeli, 002_policies rollout rehberi, Deno ortam değişkenleri (env) dönüşümü, regresyon testleri ve kontrol listesini içerir.

Not:
- Varsayılan dağıtım Postgres + Deno self-hosted’tır (deno_postgres client).
- Supabase’e dönüş dokümantasyonu opsiyonel bir referans olarak kalır; mevcut akış Supabase’e bağlı değildir.

## 1) Roller ve Sorumluluklar

- app_admin
  - Kullanım: migration/DDL (schema değişiklikleri, index/constraint oluşturma).
  - Uygulama runtime’ında kullanılmaz.
- app_user
  - Kullanım: uygulama runtime (edge functions / webhook işleyicileri).
  - En az yetki prensibi: yalnızca gereken tablo işlemleri (SELECT/INSERT/UPDATE).
  - DELETE/DDL yetkileri verilmez.
- readonly
  - Kullanım: raporlama/analitik (yalnızca SELECT).

Notlar:
- Her rol için güçlü parola kullanın.
- Rolleri yalnızca ilgili veritabanında tanımlayın (ör: PG_DATABASE=crm).

## 2) 002_policies.sql Rollout Rehberi (Staging → Prod)

1. Staging’de rollerin oluşturulması:
   - CREATE ROLE app_admin LOGIN PASSWORD '...';
   - CREATE ROLE app_user LOGIN PASSWORD '...';
   - CREATE ROLE readonly LOGIN PASSWORD '...';

2. İzinlerin verilmesi (idempotent GRANT):
   - contacts: app_user için SELECT/INSERT/UPDATE
   - activities: app_user için SELECT/INSERT
   - deals: app_user için SELECT/INSERT/UPDATE
   - pipelines: app_user için SELECT
   - pipeline_stages: app_user için SELECT
   - webhooks_log_dev (dev’de): app_user için INSERT
   - readonly için ilgili tablolarda SELECT

3. REVOKE ile gereksiz geniş yetkileri kapatın:
   - app_user’dan DELETE/DDL (CREATE/ALTER/DROP) yetkilerini vermeyin.
   - public/other rollerden gereksiz hakları geri alın (gerekiyorsa).

4. Staging regresyon testi:
   - Instantly Reply akışı için 200/409 testini çalıştırın (aşağıdaki “Regresyon Testleri”).
   - Hata “permission denied for table …” gibi gelirse, ilgili tablo için GRANT ekleyin.

5. Prod rollout:
   - 002_policies.sql’i prod’da çalıştırın.
   - Uygulama env’lerinde PG_USER/PG_PASSWORD → app_user olarak güncelleyin.
   - Regresyon testlerini prod ortamında yeniden çalıştırın.

## 3) Deno Env (Postgres-only, self-hosted)

Örnek (prod):
- PG_HOST=...
- PG_PORT=5432
- PG_DATABASE=crm
- PG_USER=app_user
- PG_PASSWORD=********
- LOG_LEVEL=info
- DEV_SIGNATURE_BYPASS=false
- HMAC_SHARED_SECRET_INSTANTLY=********
- HMAC_SHARED_SECRET_CALCOM=******** (varsa)

Öneriler:
- prod’da debug loglarını minimuma indirin.
- mümkünse TLS bağlantı kullanın.
- bağlantı havuzu (pgBouncer) ve bağlantı sayısını sınırlandırın.
- deno_postgres için connection string yerine ayrı env değişkenleri kullanın; CI/CD’de secret yönetimi uygulayın.

Opsiyonel (Supabase dönüş):
- Supabase Edge/Deno ve Service Role anahtarlarıyla çalışmak opsiyoneldir; bu mimari mevcut dağıtımın parçası değildir.

## 4) Regresyon Testleri (Instantly Reply / Step E)

1) Server (Deno self-hosted):
deno run -A --env --unstable "C:\cursor\özel satış otomasyonu\crm\functions\crm-webhooks\instantly-reply\index.ts"

2) İlk POST (200 beklenir):
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://127.0.0.1:8000" -ContentType "application/json" -Body "{ ""event"": ""reply"", ""campaign_id"": ""cmp_789"", ""lead"": { ""email"": ""mike@globex.com"", ""full_name"": ""Mike Neo"", ""website"": ""https://globex.example"" }, ""message"": { ""text"": ""pricing details?"", ""subject"": ""Re: Intro"", ""received_at"": ""2025-08-05T10:00:00Z"" }, ""idempotency_key"": ""evt_pg_010"" }"

Beklenen yanıt: 200 OK ve body’de "step":"E:deal_created_and_logged", deal_id/system_activity_id

3) Aynı POST (409 beklenir):
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "http://127.0.0.1:8000" -ContentType "application/json" -Body "{ ""event"": ""reply"", ""campaign_id"": ""cmp_789"", ""lead"": { ""email"": ""mike@globex.com"", ""full_name"": ""Mike Neo"", ""website"": ""https://globex.example"" }, ""message"": { ""text"": ""pricing details?"", ""subject"": ""Re: Intro"", ""received_at"": ""2025-08-05T10:00:00Z"" }, ""idempotency_key"": ""evt_pg_010"" }"

Beklenen yanıt: 409 Duplicate event (idempotency)

## 5) Kontrol Listesi

- [ ] app_admin/app_user/readonly roller oluşturuldu.
- [ ] 002_policies.sql staging’de uygulandı; GRANT/REVOKE doğrulandı.
- [ ] PG_USER/PG_PASSWORD → app_user ile test edildi (200/409).
- [ ] Prod’a rollout tamamlandı; env güncellendi.
- [ ] LOG_LEVEL=info; gereksiz debug kapalı.
- [ ] Bağlantı güvenliği (TLS/pooling) gözden geçirildi.

## 6) Sık Karşılaşılan Sorunlar

- ON CONFLICT hataları: ilgili tabloda UNIQUE/constraint eksikliği. İlgili constraint/index’i oluşturun.
- Permission denied: 002_policies içinde eksik GRANT. Hangi tablo/komutsa oraya idempotent GRANT ekleyin.
- Eski şema kalıntıları (ör. deals.stage NOT NULL): Kolonu kaldırın veya nullable yapın; yeni şema stage_id/pipeline_id kullanır.
