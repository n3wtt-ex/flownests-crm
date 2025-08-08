'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Kanban from '../crm/components/Kanban';
import {
  getDealsByPipeline,
  getPipelineStages,
  updateDealStage,
  getOpenDealsCount,
  getLast7DaysReplyCount,
  getPipelineConversion,
  Deal,
  Stage,
  PipelineConversion,
  DealCard,
} from '../services/crmApi';

const DEFAULT_PIPELINE_ID = 'p_default';

type DealsByStage = Record<string, DealCard[]>;

function groupDealsByStage(deals: DealCard[]): DealsByStage {
  const out: DealsByStage = {};
  for (const d of deals) {
    if (!out[d.stage_id]) out[d.stage_id] = [];
    out[d.stage_id].push(d);
  }
  return out;
}

export default function CrmKanbanPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Reporting MVP states
  const [openDealsCount, setOpenDealsCount] = useState<number | null>(null);
  const [last7Replies, setLast7Replies] = useState<number | null>(null);
  const [conversion, setConversion] = useState<PipelineConversion[] | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const [st, dealsResponse, openCnt, last7, conv] = await Promise.all([
          getPipelineStages(DEFAULT_PIPELINE_ID),
          getDealsByPipeline(DEFAULT_PIPELINE_ID),
          getOpenDealsCount(DEFAULT_PIPELINE_ID),
          getLast7DaysReplyCount(),
          getPipelineConversion(DEFAULT_PIPELINE_ID),
        ]);
        if (!mounted) return;
        setStages(st);
        
        // If getDealsByPipeline returns grouped data, flatten it to Deal array
        const flatDeals = Array.isArray(dealsResponse) 
          ? dealsResponse 
          : Object.values(dealsResponse).flat();
        setDeals(flatDeals);
        setOpenDealsCount(openCnt);
        setLast7Replies(last7);
        setConversion(conv);
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

  // Add console logs here to inspect stages and deals
  console.log('CrmKanbanPage: stages state', stages);
  console.log('CrmKanbanPage: deals state', deals);

  const dealsByStage = useMemo(() => groupDealsByStage(deals), [deals]);

  // Live conversion snapshot — recompute on local deals/stages change (optimistic update dahil)
  const liveConversion = useMemo(() => {
    if (!stages || stages.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const s of stages) counts[s.id] = 0;
    for (const d of deals) {
      if (counts[d.stage_id] !== undefined) counts[d.stage_id] += 1;
    }
    const ordered = stages.slice().sort((a, b) => a.order_index - b.order_index);
    return ordered.map((s, idx) => {
      const count = counts[s.id] || 0;
      let conv: number | undefined = undefined;
      if (idx < ordered.length - 1) {
        const next = ordered[idx + 1];
        const nextCount = counts[next.id] || 0;
        conv = count > 0 ? Math.round((nextCount / count) * 100) : undefined;
      }
      return { stage_id: s.id, stage_name: s.name, count, conversion_to_next: conv };
    });
  }, [stages, deals]);

  // Handle drop → call mock API for now
  const handleStageDrop = useCallback(async (dealId: string, fromStageId: string, toStageId: string) => {
    // optimistic handled in Kanban; we just call API and return status
    const res = await updateDealStage(dealId, toStageId);
    if (!res.ok) return { ok: false, error: res.error };
    // sync local deals state to reflect server (mock) update
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: toStageId } : d)));
    return { ok: true };
  }, []);

  const handleCardClick = (dealId: string) => {
    // App Router navigation
    window.location.href = `/app/crm/deal/${dealId}`;
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: '0 0 12px 0' }}>Pipeline</h1>

      {/* Reporting MVP */}
      {!loading && !err && (
        <div className="crm-report-cards">
          <div className="report-card">
            <div className="report-title">Open deals</div>
            <div className="report-value">{openDealsCount ?? '—'}</div>
          </div>
          <div className="report-card">
            <div className="report-title">Replies (last 7 days)</div>
            <div className="report-value">{last7Replies ?? '—'}</div>
          </div>
          <div className="report-card conversion">
            <div className="report-title">Pipeline conversion (snapshot)</div>
            <div className="report-list">
              {(liveConversion || conversion || []).map((c) => (
                <div key={c.stage_id} className="report-list-item">
                  <span className="report-stage">{c.stage_name}</span>
                  <span className="report-count">{c.count}</span>
                  {typeof c.conversion_to_next === 'number' && (
                    <span className="report-next">→ {c.conversion_to_next}%</span>
                  )}
                </div>
              ))}
              {(!(liveConversion || conversion) || (liveConversion || conversion)!.length === 0) && (
                <div className="report-empty">No data</div>
              )}
            </div>
          </div>
        </div>
      )}
      {loading && <div>Yükleniyor…</div>}
      {err && <div style={{ color: 'crimson' }}>Hata: {err}</div>}
      {!loading && !err && stages.length === 0 && (
        <div>Henüz stage bulunamadı. Seed verileri yükleyin.</div>
      )}
      {!loading && !err && stages.length > 0 && (
        <Kanban
          stages={stages}
          dealsByStage={dealsByStage}
          onCardClick={handleCardClick}
          onStageDrop={handleStageDrop}
        />
      )}
    <style jsx>{`
      .crm-report-cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 8px 0 16px 0;
      }
      @media (max-width: 980px) {
        .crm-report-cards {
          grid-template-columns: 1fr;
        }
      }
      .report-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 12px;
        box-shadow: var(--shadow-sm);
      }
      .report-title { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
      .report-value { font-size: 22px; font-weight: 700; }
      .conversion .report-list { display: grid; gap: 6px; }
      .report-list-item {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
        align-items: center;
        font-size: 13px;
      }
      .report-stage { color: var(--text); }
      .report-count { color: var(--muted); }
      .report-next {
        background: #eef2ff;
        color: #3730a3;
        font-size: 12px;
        border-radius: 999px;
        padding: 2px 8px;
        border: 1px solid var(--border);
      }
      .report-empty { color: var(--muted); font-size: 12px; }
    `}</style>
    </div>
  );
}
