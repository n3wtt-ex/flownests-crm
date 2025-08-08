'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Stage, DealCard } from '../../services/crmApi';

type DealsByStage = Record<string, DealCard[]>;

type KanbanProps = {
  stages: Stage[];
  dealsByStage: DealsByStage;
  onCardClick?: (dealId: string) => void;
  onStageDrop?: (dealId: string, fromStageId: string, toStageId: string) => Promise<{ ok: boolean; error?: string }>|void;
};

export default function Kanban({ stages, dealsByStage, onCardClick, onStageDrop }: KanbanProps) {
  const COLUMN_WIDTH = 208; // keep in sync with --kanban-col-w (globals.css)

  // Local working copy for optimistic UI
  const [localDealsByStage, setLocalDealsByStage] = useState<DealsByStage>(dealsByStage);

  // Sync when upstream prop changes (simple shallow sync)
  React.useEffect(() => {
    setLocalDealsByStage(dealsByStage);
  }, [dealsByStage]);

  const sortedStages = useMemo(() => stages.slice().sort((a, b) => a.order_index - b.order_index), [stages]);

  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, dealId: string, fromStageId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ dealId, fromStageId }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const optimisticMove = useCallback((dealId: string, fromStageId: string, toStageId: string) => {
    setLocalDealsByStage((prev) => {
      const next: DealsByStage = { ...prev, [fromStageId]: [...(prev[fromStageId] || [])], [toStageId]: [...(prev[toStageId] || [])] };
      const idx = next[fromStageId].findIndex((d) => d.id === dealId);
      if (idx === -1) return prev;
      const [card] = next[fromStageId].splice(idx, 1);
      next[toStageId].unshift({ ...card, stage_id: toStageId });
      return next;
    });
  }, []);

  const rollbackMove = useCallback((dealId: string, fromStageId: string, toStageId: string) => {
    // inverse of optimisticMove
    setLocalDealsByStage((prev) => {
      const next: DealsByStage = { ...prev, [fromStageId]: [...(prev[fromStageId] || [])], [toStageId]: [...(prev[toStageId] || [])] };
      const idx = next[toStageId].findIndex((d) => d.id === dealId);
      if (idx === -1) return prev;
      const [card] = next[toStageId].splice(idx, 1);
      next[fromStageId].unshift({ ...card, stage_id: fromStageId });
      return next;
    });
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, targetStageId: string) => {
    e.preventDefault();
    try {
      const dataRaw = e.dataTransfer.getData('application/json');
      if (!dataRaw) return;
      const { dealId, fromStageId } = JSON.parse(dataRaw) as { dealId: string; fromStageId: string };
      if (!dealId || !fromStageId || fromStageId === targetStageId) return;

      // optimistic update
      optimisticMove(dealId, fromStageId, targetStageId);

      // notify parent (which will call API)
      if (onStageDrop) {
        const res = await onStageDrop(dealId, fromStageId, targetStageId);
        if (res && !res.ok) {
          // rollback on error
          rollbackMove(dealId, fromStageId, targetStageId);
          // basic visual feedback (can be replaced with toast)
          console.error('Stage change failed:', res.error);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [onStageDrop, optimisticMove, rollbackMove]);

  return (
    <div className="crm-kanban-root">
      <div className="crm-kanban-row">
        {sortedStages.map((s, idx) => (
          <div
            key={s.id}
            className={`crm-kanban-col ${idx % 2 === 0 ? 'col-a' : 'col-b'}`}
            id={s.id}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, s.id)}
          >
            <div className="crm-kanban-col-header">
              <div className="crm-kanban-col-title">{s.name}</div>
              <div className="crm-kanban-col-meta">{(dealsByStage[s.id]||[]).length} deals</div>
            </div>
            <div className="crm-kanban-col-body" role="list">
              {(localDealsByStage[s.id] || []).map((d) => (
                <div
                  key={d.id}
                  role="listitem"
                  tabIndex={0}
                  className="crm-kanban-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, d.id, s.id)}
                  onClick={() => onCardClick?.(d.id)}
                  onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onCardClick?.(d.id) }}
                >
                  <div className="crm-card-title">{d.title}</div>
                  {typeof d.amount === 'number' && (
                    <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                      {d.amount.toLocaleString()} {d.currency || 'USD'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .crm-kanban-root {
          height: 100vh;
          padding: 16px;
          box-sizing: border-box;
          overflow-x: auto;
          overflow-y: hidden;
        }
        /* use global helpers when present */
        :global(.kanban) { display: flex; gap: var(--gap-4); overflow-x: auto; padding-bottom: var(--gap-2); }
        :global(.kanban-col) { min-width: var(--kanban-col-w); max-width: var(--kanban-col-w); }
        :global(.card) { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); padding: var(--gap-3); }
        :global(.text-muted){ color: var(--muted); }
        .crm-kanban-row {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: ${COLUMN_WIDTH}px;
          gap: 16px;
          height: calc(100vh - 32px);
        }
        .crm-kanban-col {
          border: 1px solid rgba(0,0,0,.06);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          height: 100%;
          box-shadow: var(--shadow-sm);
        }
        /* Force all columns same as background (RAL 9010) */
        .crm-kanban-col.col-a { background: var(--panel) !important; }
        .crm-kanban-col.col-b { background: var(--panel) !important; }
        .crm-kanban-col-header {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          position: sticky;
          top: 0;
          background: var(--panel);
          z-index: 1;
        }
        .crm-kanban-col-title { font-weight: 600; }
        .crm-kanban-col-meta { font-size: 12px; color: var(--muted); }
        .crm-kanban-col-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .crm-kanban-card {
          background: color-mix(in srgb, var(--card-base) 92%, #ffffff 8%) !important; /* #fff6df softened */
          border: 1px solid rgba(0,0,0,.06);
          border-radius: var(--radius-md);
          padding: 6px 8px; /* slightly smaller to match 35% scale */
          box-shadow: var(--shadow-sm);
          outline: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
