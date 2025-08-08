import React, { useCallback, useMemo, useState } from 'react';
import type { Tables } from '../../services/supabase.types';

export type Deal = Tables<'deals'>;
export type Contact = Tables<'contacts'>;
export type Stage = Tables<'pipeline_stages'>;

export type DealDetailProps = {
  deal: Deal;
  stageName?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  children?: React.ReactNode;
  rightPanel?: React.ReactNode;

  onSave?: (update: Partial<Deal> & { id: string }) => Promise<{ ok: boolean; error?: string }>|void;
  getStagesForSelect?: () => Array<{ id: string; name: string }>;
};

export function DealDetail({
  deal,
  stageName,
  companyName,
  contactName,
  children,
  rightPanel,
  onSave,
  getStagesForSelect,
}: DealDetailProps) {
  const [editing, setEditing] = useState<null | 'title' | 'amount' | 'close_date' | 'stage'>(null);
  const [draft, setDraft] = useState<Partial<Deal>>({});
  const [error, setError] = useState<string | null>(null);
  const stagesForSelect = useMemo(() => getStagesForSelect?.() || [], [getStagesForSelect]);

  const beginEdit = useCallback((field: 'title' | 'amount' | 'close_date' | 'stage') => {
    setError(null);
    setEditing(field);
    setDraft({
      id: deal.id,
      title: deal.title,
      amount: deal.amount ?? undefined,
      currency: deal.currency ?? undefined,
      close_date: deal.close_date ?? undefined,
      stage_id: deal.stage_id,
    });
  }, [deal]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setError(null);
    setDraft({});
  }, []);

  const applySave = useCallback(async () => {
    if (!onSave || !editing) {
      setEditing(null);
      return;
    }
    // basic validations
    if (editing === 'amount' && typeof draft.amount !== 'undefined' && Number.isNaN(Number(draft.amount))) {
      setError('Amount numerik olmalı');
      return;
    }
    if (editing === 'close_date' && typeof draft.close_date !== 'undefined') {
      const t = Date.parse(draft.close_date as string);
      if (Number.isNaN(t)) {
        setError('close_date ISO formatında olmalı (YYYY-MM-DD veya ISO datetime)');
        return;
      }
    }
    const result = await onSave({ id: deal.id, ...draft });
    if (result && !result.ok) {
      setError(result.error || 'Kaydetme hatası');
      return;
    }
    setEditing(null);
    setError(null);
  }, [onSave, editing, draft, deal.id]);

  return (
    <div className="crm-deal-detail">
      {(() => {
        try {
          if (!deal || !deal.title) {
            return <div className="empty">Fırsat bilgisi bulunamadı.</div>;
          }
        } catch (e) {
          return <div className="error">Fırsat bilgisi yüklenirken bir sorun oluştu.</div>;
        }
        return null;
      })()}

      <div className="crm-deal-main">
        {/* Title */}
        <div className="crm-deal-title-row">
          {editing === 'title' ? (
            <div className="edit-row">
              <input
                type="text"
                defaultValue={deal.title}
                onChange={(e) => setDraft((d: Partial<Deal>) => ({ ...d, title: e.target.value }))}
              />
              <button onClick={applySave}>Kaydet</button>
              <button onClick={cancelEdit} className="muted">İptal</button>
            </div>
          ) : (
            <h2 className="crm-deal-title" onDoubleClick={() => beginEdit('title')} title="Çift tıkla ve düzenle">
              {deal.title}
            </h2>
          )}
        </div>

        {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}

        <div className="crm-deal-grid">
          <div className="crm-deal-fields">
            {/* Stage */}
            <div>
              <b>Stage:</b>{' '}
              {editing === 'stage' ? (
                <span className="edit-row">
                  <select
                    defaultValue={deal.stage_id}
                    onChange={(e) => setDraft((d: Partial<Deal>) => ({ ...d, stage_id: e.target.value }))}
                  >
                    {stagesForSelect.map((s: { id: string; name: string }) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button onClick={applySave}>Kaydet</button>
                  <button onClick={cancelEdit} className="muted">İptal</button>
                </span>
              ) : (
                <span onDoubleClick={() => beginEdit('stage')} title="Çift tıkla ve düzenle">
                  {stageName || deal.stage_id}
                </span>
              )}
            </div>

            {/* Amount */}
            <div>
              <b>Amount:</b>{' '}
              {editing === 'amount' ? (
                <span className="edit-row">
                  <input
                    type="number"
                    defaultValue={deal.amount ?? ''}
                    onChange={(e) => setDraft((d: Partial<Deal>) => ({ ...d, amount: Number(e.target.value) }))}
                  />
                  <button onClick={applySave}>Kaydet</button>
                  <button onClick={cancelEdit} className="muted">İptal</button>
                </span>
              ) : (
                <span onDoubleClick={() => beginEdit('amount')} title="Çift tıkla ve düzenle">
                  {deal.amount !== null ? `${deal.amount} ${deal.currency || 'USD'}` : '—'}
                </span>
              )}
            </div>

            {/* Close Date */}
            <div>
              <b>Close Date:</b>{' '}
              {editing === 'close_date' ? (
                <span className="edit-row">
                  <input
                    type="date"
                    defaultValue={deal.close_date ? deal.close_date.substring(0, 10) : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // normalize to YYYY-MM-DD
                      setDraft((d: Partial<Deal>) => ({ ...d, close_date: raw ? raw : null }));
                    }}
                  />
                  <button onClick={applySave}>Kaydet</button>
                  <button onClick={cancelEdit} className="muted">İptal</button>
                </span>
              ) : (
                <span onDoubleClick={() => beginEdit('close_date')} title="Çift tıkla ve düzenle">
                  {deal.close_date || '—'}
                </span>
              )}
            </div>

            {/* Source (read-only) */}
            {deal.source && (
              <div>
                <b>Source:</b> {deal.source}
              </div>
            )}

            {/* Company */}
            {companyName !== null && companyName !== undefined ? (
              <div>
                <b>Company:</b> {companyName}
              </div>
            ) : (
              <div className="empty" style={{ padding: '8px 10px', marginTop: 6 }}>Şirket bilgisi bulunamadı.</div>
            )}

            {/* Contact */}
            {contactName !== null && contactName !== undefined ? (
              <div>
                <b>Contact:</b> {contactName}
              </div>
            ) : (
              <div className="empty" style={{ padding: '8px 10px', marginTop: 6 }}>Kişi bilgisi bulunamadı.</div>
            )}
          </div>
        </div>

        <div className="crm-deal-timeline">{children}</div>
      </div>

      <div className="crm-deal-side">{rightPanel}</div>

      <style jsx>{`
        .crm-deal-detail {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: var(--gap-4);
          align-items: start;
        }
        @media (max-width: 980px) {
          .crm-deal-detail {
            grid-template-columns: 1fr;
          }
        }
        .crm-deal-main {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--gap-4);
          box-shadow: var(--shadow-sm);
        }
        .crm-deal-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .crm-deal-title {
          margin: 0 0 var(--gap-3) 0;
          font-size: 20px;
          font-weight: 700;
        }
        .crm-deal-grid { margin-bottom: var(--gap-4); }
        .crm-deal-fields > div { margin: 6px 0; }
        .crm-deal-fields b { color: var(--muted); margin-right: 6px; font-weight: 600; }
        .crm-deal-timeline {
          margin-top: var(--gap-3);
          border-top: 1px solid var(--border);
          padding-top: var(--gap-3);
        }
        .crm-deal-side {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--gap-3);
          box-shadow: var(--shadow-sm);
        }
        .edit-row { display: inline-flex; gap: 8px; align-items: center; }
        .muted { color: var(--muted); }
        .error { color: #b91c1c; }
      `}</style>
    </div>
  );
}

export default DealDetail;
