# STEP 4 — UI İskeleti (Read-Only) Planı

Durum: Bu doküman, Sprint 1 kapsamında hedeflenen read-only CRM UI iskeletinin kapsamını, bilgi mimarisini, komponent ağacını, veri erişim katmanını ve tasarım prensiplerini tanımlar. Uygulama ilerledikçe bu dosya güncellenecektir.

Bağlam:
- Vizyon: Minimalist, modern, embedlenebilir CRM paneli (/app/crm altında).
- MVP: Kanban (read), Deal Detail (read), Activity Timeline (read), Contact Quick (read).
- Backend: Supabase/Postgres (RLS), Edge Functions (actions+webhooks), n8n (otomasyon).
- Güvenlik: Supabase Auth (JWT), read-only için server-side fetch önerilir.

---

## 1) Route ve Sayfa Yapısı

- /app/crm
  - Açıklama: Pipeline Kanban ana görünüm (read-only)
  - Veri: stages (pipeline_stages), deals (by pipeline, stage_id ile gruplanmış)
- /app/crm/deal/[id]
  - Açıklama: Deal detay sayfası (read-only)
  - Veri: deal, bağlı company/contact, stage name, activities (related deal), contact quick

Opsiyonel (ileride):
- /app/crm/pipeline/[id] — birden fazla pipeline desteği
- /app/crm/search?q= — global arama

---

## 2) Komponentler ve Sözleşmeleri

components/Kanban.tsx
- Props:
  - stages: { id, name, order_index }[]
  - dealsByStage: Record<stage_id, DealCard[]> (DealCard: { id, title, company?, contact?, amount?, currency?, stage_id })
  - onCardClick?: (dealId: string) => void
- İşlev: Read-only sütunlar ve kartlar; click ile /app/crm/deal/[id]’e yönlendirme

components/DealDetail.tsx
- Props:
  - deal: { id, title, amount?, currency?, stage_id, close_date?, source?, company_id?, contact_id? }
  - stageName?: string
  - companyName?: string
  - contactName?: string
  - children?: ReactNode (ActivityTimeline yerleşimi)
  - rightPanel?: ReactNode (ContactQuick yerleşimi)
- İşlev: Detay başlığı ve temel alanlar; orta alanda timeline, sağ panelde contact quick

components/ActivityTimeline.tsx
- Props:
  - items: Activity[] (Activity: { id, type, content?, created_at, meta_json? })
- İşlev: Ters kronolojik liste

components/ContactQuick.tsx
- Props:
  - contact: { id, full_name?, email?, title?, linkedin_url?, website?, reply_status?, reply_summary? }
- İşlev: Kısa kişi özeti ve dış linkler

Not: Sprint 2’de inline edit, drag&drop, action butonları eklenecek.

---

## 3) Data Access Layer — services/crmApi.ts

Fetch fonksiyonları (MVP):
- getPipelineStages(pipelineId: string)
- getDealsByPipeline(pipelineId: string)
- getDealDetail(id: string)
- getActivitiesFor(relatedType: 'deal'|'contact'|'company', relatedId: string)
- getContact(id: string)

Kaynaklar:
- Supabase client (RLS ile güvenli okuma)
- Veya backend proxy (öneri: server-side fetch ve JWT doğrulama)

Örnek şemaya göre Select Alanları:
- stages: pipeline_stages(id, pipeline_id, name, order_index, probability)
- deals: deals(id, title, company_id, contact_id, pipeline_id, stage_id, amount, currency, close_date, status, source, notes, created_at)
- activities: activities(id, type, related_type, related_id, content, meta_json, created_at)
- contact: contacts(id, full_name, email, title, linkedin_url, website, reply_status, reply_summary)

---

## 4) Sayfa Veri Toplama Stratejisi

/app/crm (Kanban)
- Stages:
  - Varsayılan pipeline: pipelines.is_default = true
  - Stageler: pipeline_stages where pipeline_id = default
- Deals:
  - deals where pipeline_id = default
  - Gruplama: stage_id => DealCard[]
- Render:
  - Kanban(stages, dealsByStage)
  - onCardClick(id) => router.push(/app/crm/deal/${id})

/app/crm/deal/[id]
- Deal:
  - deals by id
- İlişkili İsimler:
  - stage name: join pipeline_stages by deal.stage_id
  - company contact isimleri: companies/contacts tablosundan select
- Timeline:
  - activities where related_type='deal' and related_id = deal.id
- Right Panel:
  - contact quick: contacts by deal.contact_id

---

## 5) Tasarım Dili ve UI Kit Önerisi

- Typography: Modern, okunaklı (Inter/IBM Plex Sans/Source Sans)
- Spacing: 8px grid; boşluklar bol, yoğun veri için compact varyant
- Renk Paleti:
  - Nötr arka plan: #0B0F17 (dark) veya #F8FAFC (light)
  - Aksan: Mavi ton (örn. #3B82F6)
  - Badgeler: type’e göre renkli (email_in, meeting, system)
- Bileşen Kütüphanesi:
  - Tailwind CSS + headless UI (öneri)
  - Alternatif: Mantine, Chakra, AntD (embed senaryosunda stil izolasyonuna dikkat)
- Responsive:
  - Kanban sütunlarının yatay scroll’u olmalı
  - DealDetail: 2 sütun yapı (main + side), küçük ekranlarda alt alta

---

## 6) Performans ve UX

- Lazy veri yükleme: DealDetail’de activities ve contact ayrı çağrılar
- Skeletal loaders: Read-only listelerde basit placeholderlar
- Empty states: 
  - Kanban: “Henüz deal yok.”
  - Timeline: “Kayıtlı aktivite bulunmuyor.”
- Hata durumları: Basit inline error gösterimi (toast yok, S2’de eklenebilir)

---

## 7) Güvenlik ve Erişim

- Read için RLS aktif ise:
  - SSR/SFG (server-side) önerilir, client’a minimum alan döndürülür
- JWT zorunlu; public embed gerekiyorsa yalnızca demo veri ve açık alanlar
- PII koruması: Email/isim maskelenmesi opsiyonu (S2)

---

## 8) Uygulama Sırası ve Deliverables

A) Dosya İskeletleri (boş gövdeler, tipler tanımlı)
- web/app/crm/components/Kanban.tsx
- web/app/crm/components/DealDetail.tsx
- web/app/crm/components/ActivityTimeline.tsx
- web/app/crm/components/ContactQuick.tsx
- web/app/services/crmApi.ts
- web/app/crm/index.tsx
- web/app/crm/deal/[id].tsx

B) Veri Entegrasyonu (read-only)
- getPipelineStages + getDealsByPipeline entegrasyonu
- DealDetail veri toplama + ActivityTimeline + ContactQuick

C) Stil ve Layout
- Basit, düşük bağımlılık CSS/Tailwind
- Kanban kolon layout, kart görünümleri

D) Doğrulama
- RLS ile read’lerin çalıştığı kontrol edilir
- Demo seed ile UI render test

---

## 9) Riskler ve Azaltımlar

- RLS erişim sorunları: SSR ile service rol kullanımı veya test hesapları
- Büyük veri seti: sayfalama (S2’de), Kanban sanallaştırma (S3)
- Çoklu pipeline: MVP’de tek default pipeline, S2’de selector

---

## 10) Kabul Kriterleri (MVP)

- /app/crm: Stageler ve deal kartları read-only listeleniyor
- /app/crm/deal/[id]: Deal temel alanları, stage adı, timeline ve contact quick görünüyor
- Her iki sayfa da boş/doluluk durumlarını doğru gösteriyor
- Kod: TypeScript, komponent props tipleri belirgin
