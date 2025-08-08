import React, { useCallback, useState } from 'react';
import type { Tables } from '../../services/supabase.types';

export type Contact = Tables<'contacts'>;

export function ContactQuick({
  contact,
  onMarkInterested,
  onMarkNotInterested,
  onSendCalendarLink,
}: {
  contact: Contact;
  onMarkInterested?: (contactId: string) => Promise<{ ok: boolean; error?: string }>|void;
  onMarkNotInterested?: (contactId: string) => Promise<{ ok: boolean; error?: string }>|void;
  onSendCalendarLink?: (contactId: string) => Promise<{ ok: boolean; url?: string; error?: string }>|void;
}) {
  const [local, setLocal] = useState<Contact>(contact);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sync external updates if any
  React.useEffect(() => {
    setLocal(contact);
  }, [contact]);

  const handleInterested = useCallback(async () => {
    if (!onMarkInterested) return;
    setErr(null);
    const prev = local;
    // optimistic
    setLocal({ ...prev, reply_status: 'interested' });
    setBusy(true);
    const res = await onMarkInterested(prev.id);
    setBusy(false);
    if (res && !res.ok) {
      // rollback
      setLocal(prev);
      setErr(res.error || 'Güncelleme başarısız');
    }
  }, [local, onMarkInterested]);

  const handleNotInterested = useCallback(async () => {
    if (!onMarkNotInterested) return;
    setErr(null);
    const prev = local;
    // optimistic
    setLocal({ ...prev, reply_status: 'not_interested' });
    setBusy(true);
    const res = await onMarkNotInterested(prev.id);
    setBusy(false);
    if (res && !res.ok) {
      // rollback
      setLocal(prev);
      setErr(res.error || 'Güncelleme başarısız');
    }
  }, [local, onMarkNotInterested]);

  const handleCalendar = useCallback(async () => {
    if (!onSendCalendarLink) return;
    setErr(null);
    setBusy(true);
    const res = await onSendCalendarLink(local.id);
    setBusy(false);
    if (res && !res.ok) {
      setErr(res.error || 'Link oluşturulamadı');
    } else if (res && res.url) {
      try {
        // Basit davranış: yeni sekmede aç
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } catch {
        // Fallback: kopyala
        await navigator.clipboard.writeText(res.url);
        alert('Takvim linki panoya kopyalandı.');
      }
    }
  }, [local.id, onSendCalendarLink]);

  return (
    <div className="crm-contact-quick">
      <div className="crm-contact-name">{local.full_name || local.email || '—'}</div>
      {local.title && <div className="crm-contact-muted">{local.title}</div>}
      {local.reply_status && (
        <div className={`crm-status crm-status-${local.reply_status}`}>{local.reply_status}</div>
      )}
      {local.reply_summary && <div className="crm-contact-summary">{local.reply_summary}</div>}
      <div className="crm-contact-links">
        {local.linkedin_url && (
          <a href={local.linkedin_url} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
        {local.website && (
          <a href={local.website} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
      </div>

      <div className="crm-actions">
        <button disabled={busy} onClick={handleInterested} title="Interested olarak işaretle">Mark interested</button>
        <button disabled={busy} onClick={handleNotInterested} title="Not interested olarak işaretle">Mark not_interested</button>
        <button disabled={busy} onClick={handleCalendar} title="Takvim linki gönder (S2 placeholder)">Send calendar link</button>
      </div>
      {err && <div className="crm-error">{err}</div>}

      <style jsx>{`
        .crm-contact-quick {
          display: grid;
          gap: 6px;
        }
        .crm-contact-name { font-weight: 600; }
        .crm-contact-muted { font-size: 13px; color: var(--muted); }
        .crm-status {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          font-size: 12px;
          border-radius: 999px;
          width: fit-content;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
        }
        .crm-status-interested { background: #d1fae5; color: #065f46; }
        .crm-status-not_interested { background: #fee2e2; color: #7f1d1d; }
        .crm-status-question { background: #dbeafe; color: #1e3a8a; }
        .crm-contact-summary { font-size: 14px; color: var(--text); }
        .crm-contact-links { display: flex; gap: var(--gap-3); margin-top: 4px; }
        .crm-contact-links a { color: var(--primary); text-decoration: none; font-weight: 600; font-size: 13px; }
        .crm-contact-links a:hover { text-decoration: underline; }
        .crm-actions { display: flex; gap: 8px; margin-top: 8px; }
        .crm-actions button {
          font-size: 12px;
          padding: 6px 10px;
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 6px;
          cursor: pointer;
        }
        .crm-actions button:hover { background: rgba(0,0,0,0.03); }
        .crm-error { color: #b91c1c; font-size: 12px; }
      `}</style>
    </div>
  );
}

export default ContactQuick;
