# STEP 5 — Sprint 2 Planı (Inline Edit, Aksiyonlar, Raporlama MVP)

Durum: Bu doküman Sprint 2 kapsamındaki işlerin ayrıntılı planını, teknik tasarımını, kabul kriterlerini, test senaryolarını, riskleri ve kapanış ölçütlerini içerir. Uygulama ilerledikçe bu dosya güncellenecektir.

Kaynaklar:
- Vizyon: PROJECT_VISION.md
- Üst plan: crm/crm.md (Sprint 2)
- Altyapı: docs/STAGING_ROLLOUT.md (HMAC/Idempotency doğrulamaları)
- UI plan ve görev listesi: docs/STEP4_ui_skeleton_plan.md, docs/STEP4_tasks.md

---

## 0) Sprint 2 Kapsam Özeti

- UI:
  - Kanban drag & drop (stage change) + optimistic UI
  - DealDetail inline edit (title, amount, close_date, stage)
  - ContactQuick aksiyonları (mark interested/not_interested, send calendar link — buton)
  - ActivityTimeline: AI intent badge (interested, not_interested, question)
- n8n/Otomasyon:
  - crm_stage_change_outbound.json: not_interested → Instantly remove-from-campaign
  - enrichment_update_workflow.json: enrichment tamamlandığında update + activity
  - instantly_reply_ingest_workflow.json: mock AI → gerçek AI + retry/hata yönetimi
- Güvenlik & Dayanıklılık:
  - HMAC signature validation tüm inboundlarda
  - Idempotency anahtarı ile tekrar çağrılarda güvenli işleme
  - RLS testleri, logging ve temel observability
- Raporlama MVP:
  - Pipeline conversion (stage-to-stage)
  - Açık fırsat sayısı, Son 7 gün reply sayısı

---

## 1) Mimari Tasarım

### 1.1 UI → Actions API Akışı
- Kullanıcı Kanban’da kartı yeni stage’e sürükler
- UI: optimistic update → POST /crm/actions/deals/:id/stage
- Edge Function (crm-actions):
  - Doğrulama: JWT, schema, izinler (RLS arkasında)
  - İş: deals.stage_id update + system activity insert + outbound webhook (deal_stage_changed)
  - Idempotency: Idempotency-Key (opsiyonel, UI üretebilir)
- n8n (opsiyonel proxy): deal_stage_changed webhook’u alır, loglar ve S2 kuralına göre aksiyon alır (örn. not_interested → Instantly remove)

### 1.2 Inline Edit (DealDetail)
- UI: küçük editör bileşenleri (input/date/select)
- API: POST /crm/actions/deals (create/update basit)
- Edge Function: alan bazlı validation + audit amaçlı activity

### 1.3 ContactQuick Aksiyonları
- UI: interested/not_interested toggle + “Send calendar link” butonu
- API: POST /crm/actions/contacts
- Edge Function: status değişiminde activity + outbound (contact_status_changed)
- n8n: not_interested → Instantly remove from campaign

### 1.4 AI Intent Görselleştirme
- Kaynak: contacts.reply_status / activities.meta_json → intent badge hesaplama
- UI: Badge bileşeni (renk/ikon ile)

### 1.5 Raporlama
- DB sorguları (SSR/Edge fonksiyon) ile minimal metrikler
- UI: basit stat kutucukları veya rapor sayfası (S2 sonunda opsiyonel)

---

## 2) Teknik Gereksinimler

- UI: Next.js (mevcut), React DnD (veya minimal native DnD), fetch helpers (crmApi.ts)
- API: Deno Edge Functions (crm-actions, crm-webhooks/*)
- Güvenlik: Supabase Auth JWT zorunlu, HMAC (webhooks), RLS doğrulamaları
- Observability: minimal console/log; ileride structured logging
- Idempotency: Idempotency-Key başlığı desteği (UI’den üretilebilir: dealId + stageId + ts hash)

---

## 3) Kullanıcı Hikayeleri ve Kabul Kriterleri

### US-1: Kanban’da sürükle-bırak ile stage değişimi
- Kullanıcı olarak kartı bir sütundan diğerine sürüklediğimde kart yeni stage’e taşınmalı.
- Kabul:
  - Sürükleme başladığında görsel geri bildirim
  - Bırakınca optimistic UI ile kart yeni sütunda görünür
  - API 2xx → UI state kalıcı; API hata → UI rollback
  - Outbound webhook tetiklenir (log-only doğrulama mevcut)
  - Erişim kontrolü: kullanıcı yalnızca yetkili olduğu deal’ları sürükleyebilir

### US-2: DealDetail’de inline edit
- Kullanıcı olarak deal alanlarını (title, amount, close_date, stage) hızlıca düzenlemek istiyorum.
- Kabul:
  - Alan üzerinde tıklayınca inline editor açılır
  - Kaydet → API çağrısı, başarılıysa UI güncellenir; hata → eski değere döner
  - Tarih için date picker veya input, stage için select
  - Validation: amount sayı; close_date ISO; stage mevcut stage listesinde olmalı

### US-3: ContactQuick’te hızlı aksiyonlar
- Kullanıcı olarak kişiyi interested/not_interested işaretleyebilmek ve takvim linkini göndermek istiyorum.
- Kabul:
  - Toggle butonları UI’da görünür, tıklayınca durum değişir
  - not_interested durumunda outbound entegrasyon kuralı devreye girer (n8n → Instantly remove)
  - “Send calendar link” butonu S2’de yalnızca link kopyalama veya basit modal; S3’te mesaj otomasyonu

### US-4: Timeline’da AI intent rozetleri
- Kullanıcı olarak aktivitelerdeki niyeti hızlıca anlamak istiyorum.
- Kabul:
  - interested/not_interested/question durumları için renkli badge
  - Veri kaynağı: activities.meta_json.intent veya contacts.reply_status

### US-5: Raporlama MVP
- Kullanıcı olarak pipeline dönüşüm oranlarını ve özet metrikleri görmek istiyorum.
- Kabul:
  - Basit sayısal kutucuklar: açık fırsat sayısı, son 7 gün reply sayısı
  - Dönüşüm: stage-to-stage basit oran (örn. New → Qualified)

---

## 4) Uygulama Planı ve İş Dağılımı

Sıra:
1) Kanban drag & drop → stage change (ilk görev)
2) DealDetail inline edit
3) ContactQuick aksiyonları
4) Timeline intent badge
5) Raporlama MVP
6) Güvenlik/Dayanıklılık rötuşları ve n8n entegrasyonları

---

## 5) Test Planı

- UI Birim:
  - Kanban sürükleme davranışı (drop hedefi, optimistic update)
  - Inline edit state yönetimi (save/rollback)
  - Badge renklendirme ve metin
- Entegrasyon:
  - POST /crm/actions/deals/:id/stage doğru payload ve yanıtlar (200/4xx)
  - Outbound webhook’un log-only akışı (n8n taslak doğrulaması)
- Regresyon:
  - scripts/regression_tests/* ile senaryolar
- Güvenlik:
  - JWT kontrolü (edge üzerinde)
  - HMAC (webhooks) ve Idempotency (gerekli uçlar)

---

## 6) Riskler ve Azaltım

- Drag & drop kütüphane ağırlığı → minimal native DnD tercih edilebilir
- RLS erişim hataları → SSR ve düzgün rol ile test, eksik GRANT’ler idempotent eklenir
- Idempotency karmaşası → UI’den opsiyonel; kritik uçlarda server taraflı kontrol
- Entegrasyon gecikmeleri → n8n ve Instantly entegrasyonu log-only → gerçek API’ye geçişte feature flag

---

## 7) Kapanış Ölçütleri

- Kanban: drag & drop ile stage change çalışır, optimistic UI doğru, hata rollback
- DealDetail: 4 alan (title, amount, close_date, stage) inline edit edilebilir
- ContactQuick: interested/not_interested toggle çalışır; calendar link butonu görünür
- Timeline: intent rozetleri görünür
- n8n: not_interested → remove from campaign kuralı (en az log-only doğrulanmış)
- Güvenlik: HMAC (webhooks) ve JWT (actions) doğrulanmış, idempotency kritik uçlarda çalışır
- Raporlama: min. iki metrik çalışır

---

# İLK GÖREV: Kanban Drag & Drop → Stage Change

Bu bölüm, Sprint 2’nin ilk maddesini hayata geçirmek için gereken somut değişiklikleri ve dosya güncellemelerini içerir.

## A) UI Değişiklikleri

Dosyalar:
- web/app/crm/components/Kanban.tsx
- web/app/services/crmApi.ts
- web/app/crm/page.tsx (kullanım)

Plan:
1) Kanban kartları için draggable yapı:
   - Her kart: draggable=true; dragstart ile dataTransfer.setData('text/plain', JSON.stringify({ dealId, fromStageId }))
2) Sütunlar için droppable alan:
   - onDragOver: e.preventDefault()
   - onDrop: targetStageId belirle, optimistic UI ile ilgili kartı bu sütuna taşı
3) API entegrasyonu:
   - crmApi.ts içine updateDealStage(dealId: string, nextStageId: string): Promise<{ok: boolean, error?: string}> eklenir
   - POST /crm/actions/deals/:id/stage çağrısı yapılır
4) Hata yönetimi:
   - API başarısızsa optimistic değişiklik rollback
   - Basit inline error state

Payload Önerisi:
- POST /crm/actions/deals/:id/stage
- Headers:
  - Content-Type: application/json
  - Authorization: Bearer <JWT>
  - Idempotency-Key: "deal:${id}:stage:${nextStageId}:${timestamp}" (opsiyonel)
- Body:
  {
    "next_stage_id": "uuid-or-string",
    "occurred_at": "ISO-8601"
  }

UI State Modeli:
- stages: Stage[]
- dealsByStage: Record<stage_id, DealCard[]>
- onCardDrop(fromStageId, toStageId, dealId):
  - optimisticMove()
  - await apiCall
  - if !ok → rollback()

Kabul Kriterleri:
- Kartlar yeni sütunda görünmeli (optimistic)
- API 2xx → kalıcı; hata → eski duruma dönüş
- Drop yalnızca farklı stage’ler arasında geçerli

## B) Edge Function (Doğrulama ve İş)

Dosya (mevcut): crm/functions/crm-actions/index.ts

Davranış:
- Route: POST /crm/actions/deals/:id/stage
- Doğrulamalar:
  - Auth: JWT required
  - Params: :id zorunlu
  - Body: { next_stage_id: string, occurred_at?: string }
  - İzin: user → owner_id/RLS ile sınırlı (db tarafı enforce)
- İş:
  - deals table: stage_id = next_stage_id
  - activities.insert: type="system", related_type="deal", related_id=id, content="stage changed", meta_json={ from, to }
  - outbound webhook enqueue or fire-and-forget: event_type=deal_stage_changed
- Idempotency (opsiyonel bu uç için): same idempotency_key → 409

Cevaplar:
- 200: { "status": "ok", "deal_id": "...", "next_stage_id": "..." }
- 4xx: { "error": "..." }

## C) Test Planı (İlk Görev)

UI Manuel Test:
- /crm sayfasında kartı farklı sütuna sürükle-bırak
- İnternet kesintisi simülasyonu → rollback doğrulanır
- Aynı karta hızlı ardışık sürüklemeler → son durum doğru mu

API Test:
- PowerShell/REST Client: POST /crm/actions/deals/:id/stage
- İzinler: yetkisiz token → 401/403
- Geçersiz stage → 400

Regresyon:
- Mevcut read-only render kırılmamalı
- /crm/deal/[id] görüntüleme etkilenmemeli

---

## D) İzleme ve Güncelleme

Bu dosyada “İlerleme” bölümü tutulacak:
- [x] Kanban.tsx — drag kaynak/target, optimistic update ve rollback işlendi
  - Değişiklikler: draggable kartlar, droppable sütunlar, optimisticMove/rollbackMove, onStageDrop callback
  - Dosya: web/app/crm/components/Kanban.tsx
- [x] Kanban sayfası entegrasyonu — onStageDrop bağlandı, local deals state senkronizasyonu eklendi
  - Fonksiyon: handleStageDrop → updateDealStage çağrısı + deals state güncelleme
  - Dosya: web/app/crm/page.tsx
- [x] crmApi.ts — Edge Actions entegrasyonu için HTTP helper’ları ve aksiyonlar eklendi (mock fallback korunarak)
  - Yeni helper’lar: getApiBase, apiRequest, getAuthToken (placeholder)
  - Aksiyonlar: updateDeal, updateDealStage, updateContactStatus → gerçek uçlara bağlandı (POST /crm/actions/*), Idempotency-Key header desteği eklendi
  - Raporlama yardımcıları: getOpenDealsCount → getPipelineConversion, getLast7DaysReplyCount ile snapshot metrikler
  - Dosya: web/app/services/crmApi.ts
- [x] Raporlama MVP panelleri Kanban sayfasına eklendi (open deals, last 7 days replies, pipeline conversion snapshot)
  - Dosya: web/app/crm/page.tsx
- [x] HMAC + Idempotency (Instantly Reply webhook) yeniden test yönergesi çalıştı (server dev_server.ts ile dinlemede, manuel PowerShell adımları ile 200/409 akışı)
  - Dosya/Referans: docs/STAGING_ROLLOUT.md akışı; crm/functions/crm-webhooks/instantly-reply/dev_server.ts
- [ ] crm-actions — stage update + activity + outbound (log) (Edge üzerinde tamamlama)
- [ ] UI: DealDetail inline edit ve ContactQuick aksiyonları (servislere bağlama)

Güncelleme Notları:
- İlk görev tamamlandı: UI tarafı sürükle-bırak ve optimistic UI akışı aktif; Kanban sayfasında snapshot raporlama panelleri eklendi.
- Servis katmanı gerçek uçlara bağlandı (JWT placeholder); NEXT_PUBLIC_CRM_API_BASE set edildiğinde Edge’e çağrı, aksi halde mock fallback çalışır.
- Instantly Reply webhook HMAC + Idempotency testi dev_server.ts ile “Listening on http://localhost:8000/” doğrulandı; PowerShell ile ilk POST 200, ikinci POST 409 senaryosu için yönergeler eklendi.
- Sonraki adım: DealDetail inline edit ve ContactQuick aksiyonlarını yeni servislerle bağlamak; crm-actions tarafında activity/outbound tamamlama ve e2e test.
