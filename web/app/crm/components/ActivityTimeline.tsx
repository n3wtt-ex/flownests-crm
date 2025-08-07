import React from 'react';

export type Activity = {
  id: string;
  type: 'email_in' | 'email_out' | 'call' | 'meeting' | 'task' | 'note' | 'system';
  content?: string;
  created_at: string;
  meta_json?: Record<string, any>;
};

export type ActivityTimelineProps = {
  items: Activity[];
};

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  const sorted = items.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // compute AI intent badge from activity meta or fallback from content keywords
  const computeIntent = (a: Activity): 'interested' | 'not_interested' | 'question' | null => {
    const intent = (a.meta_json?.intent || a.meta_json?.ai_intent || a.meta_json?.reply_status) as string | undefined;
    if (intent === 'interested' || intent === 'not_interested' || intent === 'question') return intent;
    // naive fallback based on content keywords for demo
    const c = (a.content || '').toLowerCase();
    if (c.includes('?')) return 'question';
    return null;
  };

  return (
    <div className="crm-timeline">
      {(() => {
        try {
          if (!sorted || sorted.length === 0) {
            return <div className="empty">Kayıtlı aktivite bulunmuyor.</div>;
          }
          return null;
        } catch (e) {
          return <div className="error">Aktiviteler yüklenirken bir sorun oluştu.</div>;
        }
      })()}

      {sorted.map((a) => {
        const intent = computeIntent(a);
        return (
          <div key={a.id} className="crm-timeline-item">
            <span className={`crm-badge ${badgeClass(a.type)}`}>{a.type}</span>
            <div className="crm-timeline-content">
              <div className="crm-timeline-header">
                {intent && <span className={`crm-intent ${intentBadgeClass(intent)}`}>{intent}</span>}
                <span className="crm-occurred-at">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <div className="crm-timeline-text">{a.content || '—'}</div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .crm-timeline { display: flex; flex-direction: column; gap: var(--gap-3); }
        .crm-timeline-item { display: grid; grid-template-columns: 110px 1fr; gap: var(--gap-3); align-items: start; }
        .crm-badge {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px 8px; font-size: 12px; border-radius: 999px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.02em;
          border: 1px solid var(--border); color: var(--muted); background: transparent;
        }
        .crm-badge-email_in { background: #dbeafe; color: #1e3a8a; }
        .crm-badge-email_out { background: #d1fae5; color: #065f46; }
        .crm-badge-call { background: #fee2e2; color: #7f1d1d; }
        .crm-badge-meeting { background: #fae8ff; color: #701a75; }
        .crm-badge-task { background: #fef9c3; color: #713f12; }
        .crm-badge-note { background: #e5e7eb; color: #111827; }
        .crm-badge-system { background: #f1f5f9; color: #0f172a; }

        .crm-timeline-content {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 10px 12px; box-shadow: var(--shadow-sm);
        }
        .crm-timeline-header { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .crm-occurred-at { font-size: 12px; color: var(--muted); }
        .crm-timeline-text { font-size: 14px; color: var(--text); }

        .crm-intent {
          display: inline-flex; align-items: center; padding: 2px 8px; font-size: 12px; border-radius: 999px; font-weight: 600; border: 1px solid var(--border);
        }
        .crm-intent-interested { background: #d1fae5; color: #065f46; }
        .crm-intent-not_interested { background: #fee2e2; color: #7f1d1d; }
        .crm-intent-question { background: #dbeafe; color: #1e3a8a; }
      `}</style>
    </div>
  );
}

function intentBadgeClass(intent: 'interested' | 'not_interested' | 'question') {
  switch (intent) {
    case 'interested': return 'crm-intent-interested';
    case 'not_interested': return 'crm-intent-not_interested';
    case 'question': return 'crm-intent-question';
  }
}

function badgeClass(t: Activity['type']) {
  switch (t) {
    case 'email_out': return 'crm-badge-email_out';
    case 'call': return 'crm-badge-call';
    case 'meeting': return 'crm-badge-meeting';
    case 'task': return 'crm-badge-task';
    case 'note': return 'crm-badge-note';
    case 'system': return 'crm-badge-system';
    case 'email_in':
    default: return 'crm-badge-email_in';
  }
}

export default ActivityTimeline;
