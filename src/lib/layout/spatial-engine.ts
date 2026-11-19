import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import type {
  CrossLinkRelation,
  LayoutMode,
  MindMapNode,
  MindMapWorkspace,
} from '@/lib/schemas';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export interface SpatialNodeData extends Record<string, unknown> {
  node: MindMapNode;
  isRoot: boolean;
  childCount: number;
  width: number;
  height: number;
}

export interface SpatialEdgeData extends Record<string, unknown> {
  kind: 'hierarchy' | 'crosslink';
  relation?: CrossLinkRelation;
  label?: string;
  rationale?: string;
  level?: number;
}

export type SpatialFlowNode = Node<SpatialNodeData, 'mindmapNode'>;
export type SpatialFlowEdge = Edge<SpatialEdgeData, 'semanticEdge'>;

const elk = new ELK();

export function estimateNodeDimensions(node: MindMapNode): { width: number; height: number } {
  const isRoot = node.level === 0;
  const width = isRoot ? 286 : node.level === 1 ? 256 : 234;

  const summaryLines = Math.min(3, Math.ceil((node.summary?.length || 0) / 36));
  const anchorHeight = node.anchors.length > 0 ? 28 : 0;
  const lensHeight = node.lenses.length > 0 ? 24 : 0;
  const baseHeight = isRoot ? 104 : 84;

  return {
    width,
    height: baseHeight + summaryLines * 17 + anchorHeight + lensHeight,
  };
}

/**
 * Selects Top/Right/Bottom/Left handles based on center-to-center vector so edges
 * never traverse across node bodies in any layout orientation.
 */
export function selectDirectionalHandles(
  sourcePos: { x: number; y: number; width: number; height: number },
  targetPos: { x: number; y: number; width: number; height: number }
): {
  sourceHandle: `source-${HandleSide}`;
  targetHandle: `target-${HandleSide}`;
} {
  const sx = sourcePos.x + sourcePos.width / 2;
  const sy = sourcePos.y + sourcePos.height / 2;
  const tx = targetPos.x + targetPos.width / 2;
  const ty = targetPos.y + targetPos.height / 2;

  const dx = tx - sx;
  const dy = ty - sy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' };
  }

  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
}

interface VisibleGraph {
  nodeMap: Map<string, MindMapNode>;
  hierarchyEdges: Array<{ source: string; target: string; level: number }>;
}

function collectVisibleGraph(
  rootNode: MindMapNode,
  collapsedIds: Set<string>
): VisibleGraph {
  const nodeMap = new Map<string, MindMapNode>();
  const hierarchyEdges: Array<{ source: string; target: string; level: number }> = [];

  function walk(node: MindMapNode) {
    nodeMap.set(node.id, node);
    const isCollapsed = collapsedIds.has(node.id) || Boolean(node.isCollapsed);
    if (!isCollapsed && node.children.length > 0) {
      for (const child of node.children) {
        hierarchyEdges.push({ source: node.id, target: child.id, level: child.level });
        walk(child);
      }
    }
  }

  walk(rootNode);
  return { nodeMap, hierarchyEdges };
}

async function runSingleElkLayout(
  nodes: MindMapNode[],
  edges: Array<{ source: string; target: string }>,
  layoutOptions: Record<string, string>
): Promise<Map<string, { x: number; y: number; width: number; height: number }>> {
  const dims = new Map<string, { width: number; height: number }>();
  const elkChildren = nodes.map((n) => {
    const d = estimateNodeDimensions(n);
    dims.set(n.id, d);
    return { id: n.id, width: d.width, height: d.height };
  });

  const elkEdges = edges.map((e, i) => ({
    id: `elk_e_${i}_${e.source}_${e.target}`,
    sources: [e.source],
    targets: [e.target],
  }));

  const laidOut = await elk.layout({
    id: 'mindweave-root',
    layoutOptions,
    children: elkChildren,
    edges: elkEdges,
  });

  const posMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const child of laidOut.children || []) {
    const d = dims.get(child.id) || { width: 240, height: 100 };
    posMap.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: d.width,
      height: d.height,
    });
  }
  return posMap;
}

function collectSubtreeNodesAndEdges(
  rootSubtree: MindMapNode,
  collapsedIds: Set<string>
): { nodes: MindMapNode[]; edges: Array<{ source: string; target: string }> } {
  const nodes: MindMapNode[] = [];
  const edges: Array<{ source: string; target: string }> = [];

  function walk(node: MindMapNode) {
    nodes.push(node);
    const isCollapsed = collapsedIds.has(node.id) || Boolean(node.isCollapsed);
    if (!isCollapsed) {
      for (const child of node.children) {
        edges.push({ source: node.id, target: child.id });
        walk(child);
      }
    }
  }
  walk(rootSubtree);
  return { nodes, edges };
}

async function computeBalancedPositions(
  rootNode: MindMapNode,
  collapsedIds: Set<string>
): Promise<Map<string, { x: number; y: number; width: number; height: number }>> {
  const rootDim = estimateNodeDimensions(rootNode);
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  positions.set(rootNode.id, { x: -rootDim.width / 2, y: -rootDim.height / 2, ...rootDim });

  const isRootCollapsed = collapsedIds.has(rootNode.id) || Boolean(rootNode.isCollapsed);
  if (isRootCollapsed || rootNode.children.length === 0) {
    return positions;
  }

  const rightBranches: MindMapNode[] = [];
  const leftBranches: MindMapNode[] = [];
  rootNode.children.forEach((child, idx) => {
    if (idx % 2 === 0) rightBranches.push(child);
    else leftBranches.push(child);
  });

  const layoutSide = async (
    branches: MindMapNode[],
    direction: 'RIGHT' | 'LEFT'
  ): Promise<void> => {
    if (branches.length === 0) return;

    const sideNodes: MindMapNode[] = [rootNode];
    const sideEdges: Array<{ source: string; target: string }> = [];
    for (const branch of branches) {
      sideEdges.push({ source: rootNode.id, target: branch.id });
      const sub = collectSubtreeNodesAndEdges(branch, collapsedIds);
      sideNodes.push(...sub.nodes);
      sideEdges.push(...sub.edges);
    }

    const laid = await runSingleElkLayout(sideNodes, sideEdges, {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    });

    const rootLaid = laid.get(rootNode.id);
    if (!rootLaid) return;
    const anchorCenterX = rootLaid.x + rootLaid.width / 2;
    const anchorCenterY = rootLaid.y + rootLaid.height / 2;

    for (const [id, box] of laid.entries()) {
      if (id === rootNode.id) continue;
      positions.set(id, {
        x: box.x - anchorCenterX,
        y: box.y - anchorCenterY,
        width: box.width,
        height: box.height,
      });
    }
  };

  await Promise.all([layoutSide(rightBranches, 'RIGHT'), layoutSide(leftBranches, 'LEFT')]);
  return positions;
}

export async function computeSpatialLayout(
  workspace: MindMapWorkspace,
  collapsedIds: Set<string> = new Set(),
  overrideMode?: LayoutMode
): Promise<{ nodes: SpatialFlowNode[]; edges: SpatialFlowEdge[] }> {
  const mode = overrideMode || workspace.layoutMode;
  const { nodeMap, hierarchyEdges } = collectVisibleGraph(workspace.rootNode, collapsedIds);
  const allNodes = Array.from(nodeMap.values());

  let positions: Map<string, { x: number; y: number; width: number; height: number }>;

  if (mode === 'balanced') {
    positions = await computeBalancedPositions(workspace.rootNode, collapsedIds);
  } else if (mode === 'logic_tree') {
    positions = await runSingleElkLayout(allNodes, hierarchyEdges, {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '42',
      'elk.layered.spacing.nodeNodeBetweenLayers': '105',
    });
  } else if (mode === 'flowchart') {
    positions = await runSingleElkLayout(allNodes, hierarchyEdges, {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
    });
  } else {
    // radial mode
    positions = await runSingleElkLayout(allNodes, hierarchyEdges, {
      'elk.algorithm': 'radial',
      'elk.radial.radius': '220',
      'elk.spacing.nodeNode': '60',
    });
  }

  const flowNodes: SpatialFlowNode[] = allNodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0, width: 240, height: 100 };
    return {
      id: node.id,
      type: 'mindmapNode',
      position: { x: pos.x, y: pos.y },
      data: {
        node,
        isRoot: node.level === 0,
        childCount: node.children.length,
        width: pos.width,
        height: pos.height,
      },
    };
  });

  const flowEdges: SpatialFlowEdge[] = hierarchyEdges.map((edge) => {
    const srcPos = positions.get(edge.source) || { x: 0, y: 0, width: 240, height: 100 };
    const tgtPos = positions.get(edge.target) || { x: 0, y: 0, width: 240, height: 100 };
    const handles = selectDirectionalHandles(srcPos, tgtPos);

    return {
      id: `h_${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'semanticEdge',
      data: {
        kind: 'hierarchy',
        level: edge.level,
      },
    };
  });

  for (const xl of workspace.crossLinks) {
    if (!nodeMap.has(xl.sourceNodeId) || !nodeMap.has(xl.targetNodeId)) continue;
    const srcPos = positions.get(xl.sourceNodeId);
    const tgtPos = positions.get(xl.targetNodeId);
    if (!srcPos || !tgtPos) continue;
    const handles = selectDirectionalHandles(srcPos, tgtPos);

    flowEdges.push({
      id: `xl_${xl.id}`,
      source: xl.sourceNodeId,
      target: xl.targetNodeId,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'semanticEdge',
      data: {
        kind: 'crosslink',
        relation: xl.relation,
        label: xl.label,
        rationale: xl.rationale,
      },
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
}
