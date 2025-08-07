# CRM UI (Embed) Dokümantasyonu

Amaç: Web uygulamasında /app/crm route’u altında minimalist, gömülebilir CRM panelini sunmak. MVP: Kanban (read), Deal Detail (read), Activity Timeline (read), Contact Quick (read). Sprint 2: inline editler ve drag & drop ile stage değişimi.

Durum: Taslak (Sprint 1 UI iskeleti)

---

## Mimari ve Yol

- Route: /app/crm
  - /app/crm -> Kanban ana görünüm
  - /app/crm/deal/[id] -> Deal detay sayfası
- Components:
  - components/Kanban.tsx
  - components/DealDetail.tsx
  - components/ActivityTimeline.tsx
  - components/ContactQuick.tsx
- Services:
  - services/crmApi.ts (fetch helper’ları)

UI framework tercihi size ait (Next.js/React önerilir). Örnekler React/TS varsayılarak yazılmıştır.

---

## Veri Akışı

- Read istekleri: Supabase client veya backend API proxy (öneri: backend proxy -> RLS güvenli, tek yerden kontrol).
- Mutasyonlar:
  - Sprint 1: yok veya sınırlı (read-only demolar).
  - Sprint 2: /crm/actions endpoints (stage update, inline edit).
- Kimlik Doğrulama: Supabase Auth (JWT). SSR varsa server side kontrol, CSR varsa auth guard.

---

## Kanban: components/Kanban.tsx (Read-Only MVP)

Kolonlar: pipeline_stages (Default Sales). Kartlar: deals (stage_id’ye göre gruplanır).

Görüntü: 
- Üstte pipeline seçici (Sprint 2).
- Kolon başlığında isim + open deal sayısı.
- Kart: title, company/contact kısa info, amount, badge’ler (reply_status vb. Sprint 2).

Örnek props ve kullanım:

```tsx
type Stage = { id: string; name: string; order_index: number; };
type DealCard = {
  id: string; title: string; company?: string; contact?: string;
  amount?: number; currency?: string; stage_id: string;
};

type KanbanProps = {
  stages: Stage[];
  dealsByStage: Record<string, DealCard[]>;
  onCardClick?: (dealId: string) => void;
};

export function Kanban({ stages, dealsByStage, onCardClick }: KanbanProps) {
  return (
    <div className="kanban">
      {stages.sort((a,b)=>a.order_index-b.order_index).map(stage => (
        <div key={stage.id} className="kanban-column">
          <div className="kanban-column-header">{stage.name}</div>
          <div className="kanban-column-body">
            {(dealsByStage[stage.id] || []).map(d => (
              <div key={d.id} className="kanban-card" onClick={()=>onCardClick?.(d.id)}>
                <div className="card-title">{d.title}</div>
                <div className="card-sub">
                  {d.company || d.contact || '—'}
                </div>
                {d.amount && <div className="card-amount">{d.amount} {d.currency || 'USD'}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Stil: Tailwind veya basit CSS ile sütunlar yan yana, kartlar gölge/rounded.

---

## Deal Detail: components/DealDetail.tsx (Read MVP)

Giriş: `id` ile deal bilgisi fetch edilir. Görünüm:
- Sol: temel bilgiler (title, amount, currency, stage, close_date, source).
- Orta: Activity Timeline (read).
- Sağ: Contact Quick (read).

```tsx
type Deal = {
  id: string; title: string; amount?: number; currency?: string;
  stage_id: string; close_date?: string; source?: string;
  company_id?: string; contact_id?: string;
};

type DealDetailProps = {
  deal: Deal;
  stageName?: string;
  companyName?: string;
  contactName?: string;
  rightPanel?: React.ReactNode;
  children?: React.ReactNode; // timeline inject
};

export function DealDetail({ deal, stageName, companyName, contactName, children, rightPanel }: DealDetailProps) {
  return (
    <div className="deal-detail">
      <div className="deal-main">
        <h2>{deal.title}</h2>
        <div className="grid">
          <div>
            <div><b>Stage:</b> {stageName || deal.stage_id}</div>
            {deal.amount && <div><b>Amount:</b> {deal.amount} {deal.currency || 'USD'}</div>}
            {deal.close_date && <div><b>Close Date:</b> {deal.close_date}</div>}
            {deal.source && <div><b>Source:</b> {deal.source}</div>}
            {companyName && <div><b>Company:</b> {companyName}</div>}
            {contactName && <div><b>Contact:</b> {contactName}</div>}
          </div>
        </div>
        <div className="deal-timeline">
          {children}
        </div>
      </div>
      <div className="deal-side">
        {rightPanel}
      </div>
    </div>
  );
}
```

---

## Activity Timeline: components/ActivityTimeline.tsx (Read MVP)

Sıralama: ters kronolojik. Öğeler: type badge (email_in, meeting, system...), content kısa özet, created_at, meta ikonları.

```tsx
type Activity = {
  id: string;
  type: 'email_in' | 'email_out' | 'call' | 'meeting' | 'task' | 'note' | 'system';
  content?: string;
  created_at: string;
  meta_json?: Record<string, any>;
};

type ActivityTimelineProps = {
  items: Activity[];
};

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  return (
    <div className="timeline">
      {items.sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at)).map(a => (
        <div key={a.id} className="timeline-item">
          <span className={`badge badge-${a.type}`}>{a.type}</span>
          <div className="content">{a.content || '—'}</div>
          <div className="meta">{new Date(a.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
```

Sprint 2: AI intent badge’leri (interested/not_interested/question) timeline’da görselleştirilecek.

---

## Contact Quick: components/ContactQuick.tsx (Read MVP)

Kısa özet ve aksiyon placeholder’ları (Sprint 2).

```tsx
type Contact = {
  id: string; full_name?: string; email?: string; title?: string;
  linkedin_url?: string; website?: string; reply_status?: string; reply_summary?: string;
};

export function ContactQuick({ contact }: { contact: Contact }) {
  return (
    <div className="contact-quick">
      <div className="name">{contact.full_name || contact.email}</div>
      {contact.title && <div className="muted">{contact.title}</div>}
      {contact.reply_status && <div className={`status status-${contact.reply_status}`}>{contact.reply_status}</div>}
      {contact.reply_summary && <div className="summary">{contact.reply_summary}</div>}
      <div className="links">
        {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
        {contact.website && <a href={contact.website} target="_blank" rel="noreferrer">Website</a>}
      </div>
    </div>
  );
}
```

---

## services/crmApi.ts (Read Helpers)

MVP’de fetch fonksiyonları:

```ts
export async function getPipelineStages(pipelineId: string) { /* ... */ }
export async function getDealsByPipeline(pipelineId: string) { /* ... */ }
export async function getDealDetail(id: string) { /* ... */ }
export async function getActivitiesFor(relatedType: 'deal'|'contact'|'company', relatedId: string) { /* ... */ }
export async function getContact(id: string) { /* ... */ }
```

Uygulama: Supabase client veya backend proxy. RLS aktivse server-side tercih edilir.

---

## Sayfa İskeletleri

/app/crm/index.tsx
- SSR veya CSR ile stages+dealsByStage çekilir.
- Kanban read-only render edilir.
/app/crm/deal/[id].tsx
- Deal, stages (stage_name için), company/contact, activities çekilir.
- DealDetail içinde ActivityTimeline ve ContactQuick gösterilir.

---

## Stil ve UX İlkeleri

- Minimal, boş alanlar bol, tipografi sade.
- Klavye kısayolları: S2’de eklenecek.
- Kart yüksekliği compact, bilgi yoğunluğu dengeli.
- Empty state: “Henüz deal yok. Kampanyaları çalıştırın veya yeni deal oluşturun.”

---

## Embed Seçenekleri

- Aynı origin altında native route önerilir.
- Ayrı domain gerekiyorsa:
  - iFrame + signed URL + postMessage bridge
  - Yalnızca read için CORS basitleştirilebilir, mutasyonlar server-to-server.

---

## Yol Haritası Bağlantısı

- Sprint 1: Read-only Kanban/Detail/Timeline/ContactQuick
- Sprint 2: Drag & Drop, inline editler, hızlı aksiyonlar, AI intent badge’leri
