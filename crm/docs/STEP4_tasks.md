# STEP 4 — UI İskeleti Görev Listesi (Sprint 1 Read-Only)

Durum: Bu liste, Sprint 1 kapsamında UI iskeletinin read-only versiyonunu hayata geçirmek için alt görevleri içerir. Her görev tamamlandığında işaretlenecek ve gerekiyorsa not düşülecektir.

Bağlam:
- Referans: docs/STEP4_ui_skeleton_plan.md, crm/crm.md (STEP 4 maddeleri)
- Kapsam: Read-only Kanban, Deal Detail, Activity Timeline, Contact Quick ve basit veri erişim katmanı (services/crmApi.ts)

---

## A) Proje İskeleti ve Dosyalar

- [x] web/app/crm/ dizinini oluştur
- [x] web/app/crm/components/Kanban.tsx iskeleti (props + read-only render)
- [x] web/app/crm/components/DealDetail.tsx iskeleti (props + read-only render)
- [x] web/app/crm/components/ActivityTimeline.tsx iskeleti (props + read-only render)
- [x] web/app/crm/components/ContactQuick.tsx iskeleti (props + read-only render)
- [x] web/app/services/crmApi.ts iskeleti (fonksiyon imzaları + mock veri helpers)
- [x] web/app/crm/page.tsx iskeleti (Kanban kullanım örneği, mock veri)
- [x] web/app/crm/deal/[id]/page.tsx iskeleti (DealDetail + Timeline + ContactQuick kullanım örneği, mock veri)
- [x] Minimal global stil: basit CSS ile layout (globals.css import)

Not: UI framework olarak React/Next.js varsayımı ile tipli TSX bileşenleri planlanmıştır.

---

## B) Veri Erişim Katmanı (Read Helpers)

services/crmApi.ts
- [x] getPipelineStages(pipelineId: string): Promise<Stage[]> — mock veri ile
- [x] getDealsByPipeline(pipelineId: string): Promise<DealCard[]> — mock veri ile
- [x] getDealDetail(id: string): Promise<Deal> — mock veri ile
- [x] getActivitiesFor(relatedType: 'deal'|'contact'|'company', relatedId: string): Promise<Activity[]> — mock veri ile
- [x] getContact(id: string): Promise<Contact> — mock veri ile
- [ ] Not: MVP’de mock/placeholder ile başlayıp, RLS/SSR kararına göre gerçek entegrasyon

---

## C) Kanban (Read-Only)

components/Kanban.tsx
- [x] Props tipleri: Stage, DealCard, KanbanProps
- [x] Render: kolon başlıkları, kart listeleri, onCardClick
- [x] Basit responsive düzen ve overflow-x scroll
/crm/page.tsx
- [x] Mock veri ile render testi
- [x] Router push ile /crm/deal/[id] navigasyonu

---

## D) Deal Detail + Timeline + ContactQuick (Read-Only)

components/DealDetail.tsx
- [x] Props tipleri ve layout: başlık, temel alanlar, children/rightPanel slotları
components/ActivityTimeline.tsx
- [x] Props tipleri, ters kronolojik sıralama, basit badge sınıfları
components/ContactQuick.tsx
- [x] Props tipleri, linkler, reply_status/summary alanları (okuma)
/crm/deal/[id]/page.tsx
- [x] Mock veri ile render: DealDetail içinde Timeline (children) + ContactQuick (rightPanel)

---

## E) Stil ve UX

- [x] Kanban sütun layout’u (flex + overflow-x)
- [x] Kart bileşenleri: başlık, alt satır, amount/currency (minimal)
- [x] DealDetail layout: ana + sağ panel (minimal)
- [x] Timeline item: badge, içerik, tarih (minimal)
- [x] ContactQuick: başlık, linkler, kısa özet (minimal)
- [ ] Empty state mesajları
- [ ] Hata state basit gösterimler (ör. try/catch + inline mesaj)

---

## F) Entegrasyon ve Validasyon (Opsiyonel İlk Adım)

- [ ] Supabase client veya backend proxy ile gerçek read çağrılarına geçiş (konfigürasyon + RLS test)
- [ ] Default pipeline tespiti (pipelines.is_default = true)
- [ ] Stage ve Deal select sorguları (yalın alanlar)
- [ ] Activity ve Contact sorguları
- [ ] SSR tercihine göre token/rollere uygun veri erişimi

---

## G) Dokümantasyon ve İzleme

- [x] docs/STEP4_ui_skeleton_plan.md oluşturuldu
- [x] crm/crm.md içinde “STEP 4 — UI İskeleti (Read-Only)” bölümünde ilerleme checkbox’ları güncellendi
- [x] Bu dosya (STEP4_tasks.md) tamamlanan görevlerle güncellendi ve “Notlar”a özet eklendi
- [ ] Demo ekran görüntüsü/akış için checklist (tamamlandığında eklenir)

---

## Notlar

- Sprint 2’de drag & drop (stage change), inline editler ve outbound webhook tetiklemeleri eklenecek.
- Tasarım sistemi minimal tutulmalı; embed senaryosunda stil çakışmalarına dikkat edilmeli.
- Büyük veri setlerinde sanallaştırma ve sayfalama sonraki sprintlerde ele alınacak.

Güncelleme Özeti (08-07-2025):
- A: Proje iskeleti ve tüm bileşenler oluşturuldu; crmApi mock servisleri eklendi; minimal globals.css importlandı.
- C: Kanban read-only çalışır durumda, navigasyon akışı kuruldu. Doğru route: /crm
- D: Deal Detail + Activity Timeline + Contact Quick read-only çalışır durumda. Doğru route: /crm/deal/[id]
- G: crm.md ve bu görev listesi güncellendi. Next dev 3001 portunda çalıştırılarak görüntüleme doğrulandı.
