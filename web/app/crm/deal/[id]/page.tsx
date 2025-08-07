'use client';

import React, { useCallback, useEffect, useState } from 'react';
import DealDetail from '../../../crm/components/DealDetail';
import ActivityTimeline from '../../../crm/components/ActivityTimeline';
import ContactQuick from '../../../crm/components/ContactQuick';
import {
  getActivitiesFor,
  getContactForDeal,
  getDealDetail,
  getStageName,
  getPipelineStages,
  updateDeal,
  Deal,
  Contact,
  Stage,
} from '../../../services/crmApi';

const DEFAULT_PIPELINE_ID = 'p_default';

export default function DealPage({ params }: { params: { id: string } }) {
  const dealId = params.id;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [stageName, setStageName] = useState<string | undefined>(undefined);
  const [stages, setStages] = useState<Stage[]>([]);
  const [contact, setContact] = useState<Contact | undefined>(undefined);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const d = await getDealDetail(dealId);
        if (!mounted) return;
        setDeal(d);

        const [sn, acts, cnt, st] = await Promise.all([
          getStageName(DEFAULT_PIPELINE_ID, d.stage_id),
          getActivitiesFor('deal', d.id),
          getContactForDeal(d.id),
          getPipelineStages(DEFAULT_PIPELINE_ID),
        ]);
        if (!mounted) return;
        setStageName(sn);
        setActivities(acts);
        setContact(cnt);
        setStages(st);
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
  }, [dealId]);

  // Action handlers for ContactQuick
  const handleMarkInterested = useCallback(async (contactId: string) => {
    try {
      // optimistic handled inside ContactQuick local state; here just call API if contact exists
      if (!contact || contact.id !== contactId) return { ok: false, error: 'Contact not loaded' };
      const { updateContactStatus } = await import('../../../services/crmApi');
      const res = await updateContactStatus(contactId, 'interested');
      if (!res.ok) return { ok: false, error: res.error };
      // sync page-level contact state
      setContact((prev) => (prev && prev.id === contactId ? { ...prev, reply_status: 'interested' } : prev));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to update' };
    }
  }, [contact]);

  const handleMarkNotInterested = useCallback(async (contactId: string) => {
    try {
      if (!contact || contact.id !== contactId) return { ok: false, error: 'Contact not loaded' };
      const { updateContactStatus } = await import('../../../services/crmApi');
      const res = await updateContactStatus(contactId, 'not_interested');
      if (!res.ok) return { ok: false, error: res.error };
      setContact((prev) => (prev && prev.id === contactId ? { ...prev, reply_status: 'not_interested' } : prev));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to update' };
    }
  }, [contact]);

  const handleSendCalendarLink = useCallback(async (contactId: string) => {
    try {
      const { getCalendarLink } = await import('../../../services/crmApi');
      const res = await getCalendarLink(contactId);
      if (!res.ok) return { ok: false, error: 'Unable to generate link' };
      return { ok: true, url: res.url };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to generate link' };
    }
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
          rightPanel={contact ? (
            <ContactQuick
              contact={contact}
              onMarkInterested={handleMarkInterested}
              onMarkNotInterested={handleMarkNotInterested}
              onSendCalendarLink={handleSendCalendarLink}
            />
          ) : undefined}
          getStagesForSelect={() => stages.map((s) => ({ id: s.id, name: s.name }))}
          onSave={async (update) => {
            // optimistic update of local state
            const prev = deal;
            const next = { ...prev, ...update };
            setDeal(next);
            const res = await updateDeal({ ...update, id: deal.id });
            if (!res.ok) {
              // rollback on error
              setDeal(prev);
              return { ok: false, error: res.error };
            }
            // sync any normalized value from server (e.g., amount number coercion)
            setDeal(res.deal || next);
            // update computed stage name if stage changed
            if (typeof update.stage_id !== 'undefined') {
              const sn = await getStageName(DEFAULT_PIPELINE_ID, update.stage_id);
              setStageName(sn);
            }
            return { ok: true };
          }}
        >
          <ActivityTimeline items={activities} />
        </DealDetail>
      )}
    </div>
  );
}
