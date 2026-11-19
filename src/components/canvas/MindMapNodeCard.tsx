'use client';

import { memo, useState } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import type { SpatialNodeData } from '@/lib/layout/spatial-engine';
import { useWorkspaceStore } from '@/store/workspace-store';

const HANDLE_SIDES: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; position: Position }> = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

const MASTERY_STYLES = {
  mastered: {
    label: 'Mastered',
    bg: 'var(--mw-emerald-bg)',
    color: 'var(--mw-emerald)',
  },
  partial: {
    label: 'Partial',
    bg: 'var(--mw-ochre-bg)',
    color: 'var(--mw-ochre)',
  },
  needs_review: {
    label: 'Review',
    bg: 'var(--mw-crimson-bg)',
    color: 'var(--mw-crimson)',
  },
  untested: null,
} as const;

const AGREEMENT_STYLES = {
  consensus: { label: 'Consensus', bg: 'var(--mw-emerald-bg)', color: 'var(--mw-emerald)' },
  unique: { label: 'Unique', bg: 'var(--mw-ochre-bg)', color: 'var(--mw-ochre)' },
  contradiction: {
    label: 'Contradiction',
    bg: 'var(--mw-crimson-bg)',
    color: 'var(--mw-crimson)',
  },
} as const;

function MindMapNodeCardInner({ id, data }: NodeProps) {
  const nodeData = data as unknown as SpatialNodeData;
  const { node, isRoot, childCount } = nodeData;

  const {
    selectedNodeId,
    studyMode,
    collapsedIds,
    revealedClozeIds,
    expandingNodeIds,
    evaluatingNodeIds,
    selectNode,
    toggleCollapseNode,
    revealClozeNode,
    jumpToSourceAnchor,
    expandNodeById,
    deleteNodeById,
    evaluateStudyAttempt,
    setRightDrawer,
  } = useWorkspaceStore();

  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clozeInput, setClozeInput] = useState('');

  const isSelected = selectedNodeId === id;
  const isCollapsed = collapsedIds.has(id) || Boolean(node.isCollapsed);
  const isExpanding = expandingNodeIds.has(id);
  const isEvaluating = evaluatingNodeIds.has(id);
  const isClozeMasked =
    studyMode === 'cloze' && !isRoot && !revealedClozeIds.has(id) && node.mastery !== 'mastered';

  const masteryMeta = MASTERY_STYLES[node.mastery];
  const primaryAgreement = node.anchors.find((a) => a.agreement)?.agreement;
  const agreementMeta = primaryAgreement ? AGREEMENT_STYLES[primaryAgreement] : null;

  const handleClozeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!clozeInput.trim() || isEvaluating) return;
    await evaluateStudyAttempt(id, 'cloze', clozeInput.trim());
    setClozeInput('');
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirmDelete(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNode(id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Node ${node.topic}${isSelected ? ', selected' : ''}`}
      className="relative rounded-xl border p-3.5 select-none transition-all duration-150 cursor-pointer"
      style={{
        width: nodeData.width || 240,
        backgroundColor: isRoot ? 'var(--mw-primary)' : 'var(--mw-card)',
        color: isRoot ? 'var(--mw-primary-ink)' : 'var(--mw-ink)',
        borderColor: isSelected
          ? 'var(--mw-primary)'
          : isRoot
            ? 'var(--mw-primary)'
            : 'var(--mw-border)',
        boxShadow: isSelected
          ? 'var(--mw-focus-ring)'
          : hovered
            ? 'var(--mw-shadow-lift)'
            : undefined,
      }}
    >
      {/* 4-Side Directional Handles (source + target on each side so edges never cross card) */}
      {HANDLE_SIDES.map(({ side, position }) => (
        <Handle
          key={`t-${side}`}
          id={`target-${side}`}
          type="target"
          position={position}
          style={{
            width: 8,
            height: 8,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      ))}
      {HANDLE_SIDES.map(({ side, position }) => (
        <Handle
          key={`s-${side}`}
          id={`source-${side}`}
          type="source"
          position={position}
          style={{
            width: 8,
            height: 8,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Top Metadata Strip */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isRoot ? 'rgba(255,255,255,0.18)' : 'var(--mw-bg)',
              color: isRoot ? 'var(--mw-primary-ink)' : 'var(--mw-muted)',
            }}
          >
            {isRoot ? 'ROOT' : `L${node.level}`}
          </span>

          {agreementMeta && !isRoot && (
            <span
              className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: agreementMeta.bg, color: agreementMeta.color }}
            >
              {agreementMeta.label}
            </span>
          )}

          {masteryMeta && !isRoot && (
            <span
              className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: masteryMeta.bg, color: masteryMeta.color }}
            >
              {masteryMeta.label}
              {node.masteryScore !== undefined ? ` ${node.masteryScore}%` : ''}
            </span>
          )}
        </div>

        {childCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapseNode(id);
            }}
            className="nodrag nopan w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors"
            style={{
              backgroundColor: isRoot ? 'rgba(255,255,255,0.18)' : 'var(--mw-bg)',
              color: isRoot ? 'var(--mw-primary-ink)' : 'var(--mw-muted)',
            }}
            aria-label={isCollapsed ? `Show ${childCount} children` : `Hide ${childCount} children`}
            title={isCollapsed ? `Expand ${childCount} child nodes` : 'Collapse branch'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Node Body OR Active Recall Cloze Mask */}
      {isClozeMasked ? (
        <div className="space-y-2 nodrag nopan" onClick={(e) => e.stopPropagation()}>
          <div
            className="rounded-lg border border-dashed px-2.5 py-2 text-xs font-mono"
            style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-primary)' }}
          >
            [ ? ] Recall sub-concept under {node.parentId === 'root' ? 'root' : 'parent'}
          </div>
          <form onSubmit={handleClozeSubmit} className="flex gap-1">
            <input
              type="text"
              value={clozeInput}
              onChange={(e) => setClozeInput(e.target.value)}
              placeholder="Type concept & reason..."
              className="flex-1 min-w-0 h-8 px-2 rounded-md border text-xs"
              style={{
                backgroundColor: 'var(--mw-card)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            />
            <button
              type="submit"
              disabled={isEvaluating || !clozeInput.trim()}
              className="h-8 px-2 rounded-md text-[11px] font-semibold disabled:opacity-50"
              style={{
                backgroundColor: 'var(--mw-primary)',
                color: 'var(--mw-primary-ink)',
              }}
            >
              {isEvaluating ? '...' : 'Check'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => revealClozeNode(id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium underline"
            style={{ color: 'var(--mw-muted)' }}
          >
            <Eye className="w-3 h-3" />
            Reveal answer
          </button>
        </div>
      ) : (
        <>
          <div className="text-sm font-semibold leading-snug">{node.topic}</div>
          {node.summary && (
            <p
              className="text-xs mt-1 leading-relaxed line-clamp-3"
              style={{
                color: isRoot ? 'rgba(255,255,255,0.88)' : 'var(--mw-muted)',
              }}
            >
              {node.summary}
            </p>
          )}

          {/* Grounded Citation & Timestamp Pills */}
          {node.anchors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 nodrag nopan">
              {node.anchors.slice(0, 2).map((anchor, idx) => (
                <button
                  key={`${anchor.sourceId}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(id);
                    jumpToSourceAnchor(anchor);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium border transition-opacity hover:opacity-85"
                  style={{
                    backgroundColor: isRoot ? 'rgba(255,255,255,0.16)' : 'var(--mw-cite-bg)',
                    color: isRoot ? '#ffffff' : 'var(--mw-cite-ink)',
                    borderColor: isRoot ? 'rgba(255,255,255,0.25)' : 'var(--mw-cite-border)',
                  }}
                  title={`Jump to ${anchor.label}: "${anchor.excerpt}"`}
                >
                  {anchor.sourceType === 'youtube' ? (
                    <Play className="w-2.5 h-2.5 fill-current" />
                  ) : (
                    <FileText className="w-2.5 h-2.5" />
                  )}
                  <span>{anchor.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Applied Lenses Indicator */}
          {node.lenses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 nodrag nopan">
              {node.lenses.map((lens) => (
                <button
                  key={lens.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(id);
                    setRightDrawer(true, 'inspector');
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] border"
                  style={{
                    backgroundColor: isRoot ? 'rgba(255,255,255,0.14)' : 'var(--mw-primary-soft)',
                    color: isRoot ? '#ffffff' : 'var(--mw-primary)',
                    borderColor: isRoot ? 'rgba(255,255,255,0.2)' : 'var(--mw-border)',
                  }}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>{lens.type.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Quick Hover/Selected Action Bar */}
      {(hovered || isSelected || isExpanding) && !isClozeMasked && (
        <div
          className="nodrag nopan flex items-center justify-between gap-1 mt-2.5 pt-2 border-t text-[11px]"
          style={{
            borderColor: isRoot ? 'rgba(255,255,255,0.22)' : 'var(--mw-border)',
          }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void expandNodeById(id);
              }}
              disabled={isExpanding}
              className="h-6 px-2 rounded-md font-medium inline-flex items-center gap-1 border"
              style={{
                backgroundColor: isRoot ? 'rgba(255,255,255,0.16)' : 'var(--mw-bg)',
                borderColor: isRoot ? 'rgba(255,255,255,0.24)' : 'var(--mw-border)',
                color: isRoot ? '#ffffff' : 'var(--mw-ink)',
              }}
              title="AI Expand child concepts"
            >
              {isExpanding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              <span>Expand</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectNode(id);
                setRightDrawer(true, 'inspector');
              }}
              className="h-6 px-2 rounded-md font-medium inline-flex items-center gap-1 border"
              style={{
                backgroundColor: isRoot ? 'rgba(255,255,255,0.16)' : 'var(--mw-bg)',
                borderColor: isRoot ? 'rgba(255,255,255,0.24)' : 'var(--mw-border)',
                color: isRoot ? '#ffffff' : 'var(--mw-ink)',
              }}
            >
              <Layers className="w-3 h-3" />
              <span>Lenses</span>
            </button>
          </div>

          {!isRoot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!confirmDelete) {
                  setConfirmDelete(true);
                } else {
                  deleteNodeById(id);
                }
              }}
              className="h-6 px-1.5 rounded-md inline-flex items-center gap-1 border"
              style={{
                backgroundColor: confirmDelete ? 'var(--mw-crimson-bg)' : 'var(--mw-bg)',
                borderColor: confirmDelete ? 'var(--mw-crimson)' : 'var(--mw-border)',
                color: confirmDelete ? 'var(--mw-crimson)' : 'var(--mw-muted)',
              }}
              aria-label={confirmDelete ? `Confirm delete ${node.topic}` : `Delete ${node.topic}`}
              title={confirmDelete ? 'Click again to delete' : 'Delete branch'}
            >
              {confirmDelete ? <Check className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MindMapNodeCard = memo(MindMapNodeCardInner);
export default MindMapNodeCard;
