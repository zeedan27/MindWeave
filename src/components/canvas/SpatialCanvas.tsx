'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import {
  computeSpatialLayout,
  SpatialFlowEdge,
  SpatialFlowNode,
} from '@/lib/layout/spatial-engine';
import { flattenNodesOutline, useWorkspaceStore } from '@/store/workspace-store';
import MindMapNodeCard from './MindMapNodeCard';
import SemanticCrossEdge from './SemanticCrossEdge';

const nodeTypes = { mindmapNode: MindMapNodeCard };
const edgeTypes = { semanticEdge: SemanticCrossEdge };

interface SpatialCanvasInnerProps {
  onLayoutReady?: (nodes: SpatialFlowNode[], edges: SpatialFlowEdge[]) => void;
}

function SpatialCanvasInner({ onLayoutReady }: SpatialCanvasInnerProps) {
  const { workspace, collapsedIds, selectedNodeId, studyMode, selectNode } = useWorkspaceStore();
  const { fitView, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<SpatialFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<SpatialFlowEdge>([]);
  const lastWorkspaceIdRef = useRef<string | null>(null);
  const lastLayoutModeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    let active = true;

    void computeSpatialLayout(workspace, collapsedIds, workspace.layoutMode).then(
      ({ nodes: nextNodes, edges: nextEdges }) => {
        if (!active) return;
        setNodes(nextNodes);
        setEdges(nextEdges);
        onLayoutReady?.(nextNodes, nextEdges);

        const isNewMapOrMode =
          lastWorkspaceIdRef.current !== workspace.id ||
          lastLayoutModeRef.current !== workspace.layoutMode;

        if (isNewMapOrMode) {
          lastWorkspaceIdRef.current = workspace.id;
          lastLayoutModeRef.current = workspace.layoutMode;
          const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          setTimeout(() => {
            void fitView({ padding: 0.18, duration: prefersReduced ? 0 : 380 });
          }, 60);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [workspace, collapsedIds, setNodes, setEdges, fitView, onLayoutReady]);

  // Smoothly focus camera on selected node during Guided Walkthrough
  useEffect(() => {
    if (!selectedNodeId || studyMode !== 'walkthrough') return;
    const target = nodes.find((n) => n.id === selectedNodeId);
    if (!target) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cx = target.position.x + (target.data.width || 240) / 2;
    const cy = target.position.y + (target.data.height || 100) / 2;

    void setCenter(cx, cy, {
      zoom: 1.05,
      duration: prefersReduced ? 0 : 420,
    });
  }, [selectedNodeId, studyMode, nodes, setCenter]);

  const outlineIds = useMemo(() => {
    if (!workspace) return [];
    return flattenNodesOutline(workspace.rootNode).map((n) => n.id);
  }, [workspace]);

  // Keyboard traversal across nodes
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (outlineIds.length === 0) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') {
        return;
      }
      e.preventDefault();
      const idx = selectedNodeId ? outlineIds.indexOf(selectedNodeId) : -1;
      const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (idx + delta + outlineIds.length) % outlineIds.length;
      selectNode(outlineIds[nextIdx]);
    },
    [outlineIds, selectedNodeId, selectNode]
  );

  if (!workspace) return null;

  return (
    <div
      className="w-full h-full relative"
      onKeyDown={handleCanvasKeyDown}
      role="region"
      aria-label="Spatial Knowledge Map Canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.18}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="var(--mw-border)"
        />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap
          className="!hidden sm:!block"
          pannable
          zoomable
          nodeColor={(n) =>
            n.id === 'root' ? 'var(--mw-primary)' : 'var(--mw-muted)'
          }
          maskColor="rgba(195, 215, 229, 0.35)"
        />
      </ReactFlow>
    </div>
  );
}

export default function SpatialCanvas({
  onLayoutReady,
}: {
  onLayoutReady?: (nodes: SpatialFlowNode[], edges: SpatialFlowEdge[]) => void;
}) {
  return (
    <ReactFlowProvider>
      <SpatialCanvasInner onLayoutReady={onLayoutReady} />
    </ReactFlowProvider>
  );
}
