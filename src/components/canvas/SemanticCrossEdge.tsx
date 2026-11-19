'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import type { SpatialEdgeData } from '@/lib/layout/spatial-engine';

const RELATION_COLOR: Record<string, string> = {
  contradicts: 'var(--mw-crimson)',
  supports: 'var(--mw-emerald)',
  causes: 'var(--mw-cite-ink)',
  depends_on: 'var(--mw-ochre)',
  bridges: 'var(--mw-primary)',
};

export default function SemanticCrossEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as SpatialEdgeData | undefined;
  const isCross = edgeData?.kind === 'crosslink';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: isCross ? 0.35 : 0.25,
  });

  const strokeColor = isCross
    ? RELATION_COLOR[edgeData?.relation || 'bridges'] || 'var(--mw-primary)'
    : 'var(--mw-border)';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: isCross ? 2 : 1.75,
          strokeDasharray: isCross ? '6 4' : undefined,
          opacity: isCross ? 0.9 : 0.95,
        }}
      />

      {isCross && edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto px-2 py-0.5 rounded-md border font-mono text-[10px] font-medium"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: 'var(--mw-card)',
              borderColor: strokeColor,
              color: strokeColor,
              boxShadow: 'var(--mw-shadow-lift)',
            }}
            title={edgeData.rationale}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
