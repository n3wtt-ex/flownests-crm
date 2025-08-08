import React, { useEffect, useState } from 'react';
import DealDetail from '../../crm/components/DealDetail';
import ActivityTimeline from '../../crm/components/ActivityTimeline';
import ContactQuick from '../../crm/components/ContactQuick';
import {
  getActivitiesFor,
  getContactForDeal,
  getDealDetail,
  getStageName,
  Deal,
  Contact,
} from '../../services/crmApi';

// NOTE: This page uses mock data via services/crmApi.ts for MVP.
// Replace pipelineId with real value from deal in integration if multiple pipelines are used.
const DEFAULT_PIPELINE_ID = 'p_default';

// Minimal router param reader (fallback). In real app, use framework router (e.g., Next.js useParams).
function getDealIdFromPath(): string | null {
  try {
    const parts = window.location.pathname.split('/');
    const idx = parts.findIndex((p) => p === 'deal');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {}
  return null;
}

export default function DealPage() {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stageName, setStageName] = useState<string | undefined>(undefined);
  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const id = getDealIdFromPath();
        if (!id) throw new Error('Deal id not found in URL');
        const d = await getDealDetail(id);
        
        if (!d) throw new Error('Deal not found');
        
        if (!mounted) return;
        setDeal(d);

        const [sn, acts, cnt] = await Promise.all([
          // getStageName fonksiyonunun sadece 1 parametre aldığını varsayıyoruz
          getStageName(d.stage_id), // İkinci parametreyi kaldırdık
          getActivitiesFor('deal', d.id),
          getContactForDeal(d.id),
        ]);
        if (!mounted) return;
        setStageName(sn);
        setActivities(acts);
        setContact(cnt);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: '0 0 12px 0' }}>Deal</h1>
      {loading && <div>Yükleniyor…</div>}
      {err && <div style={{ color: 'crimson' }}>Hata: {err}</div>}
      {!loading && !err && deal && (
        <DealDetail
          deal={deal}
          stageName={stageName}
          companyName={undefined}
          contactName={contact?.full_name || contact?.email}
          rightPanel={contact ? <ContactQuick contact={contact} /> : undefined}
        >
          <ActivityTimeline items={activities} />
        </DealDetail>
      )}
    </div>
  );
}