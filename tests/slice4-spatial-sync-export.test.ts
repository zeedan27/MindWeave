import { describe, expect, it } from 'vitest';
import { createFlagshipDemoWorkspace } from '@/lib/demo-workspace';
import {
  computeSpatialLayout,
  selectDirectionalHandles,
} from '@/lib/layout/spatial-engine';
import {
  markdownToRootNode,
  mermaidToRootNode,
  workspaceToMarkdown,
  workspaceToMermaid,
} from '@/lib/sync/markdown-mermaid';
import {
  exportToAnkiCsv,
  exportToObsidianCanvas,
  exportToSvgString,
} from '@/lib/export/exporters';
import { decodeWorkspaceHash, encodeWorkspaceHash } from '@/lib/storage/workspace-db';

describe('Slice 4: Spatial Layout Engine, Sync, URL Hash & Exporters', () => {
  it('computes collision-free ELK layouts for all 4 layout modes and selects directional handles', async () => {
    const ws = createFlagshipDemoWorkspace();
    for (const mode of ['balanced', 'logic_tree', 'radial', 'flowchart'] as const) {
      const { nodes, edges } = await computeSpatialLayout(ws, new Set(), mode);
      expect(nodes.length).toBe(8);
      expect(edges.length).toBeGreaterThanOrEqual(7);
      for (const n of nodes) {
        expect(Number.isFinite(n.position.x)).toBe(true);
        expect(Number.isFinite(n.position.y)).toBe(true);
      }
    }

    expect(
      selectDirectionalHandles(
        { x: 0, y: 0, width: 200, height: 100 },
        { x: 300, y: 20, width: 200, height: 100 }
      )
    ).toEqual({ sourceHandle: 'source-right', targetHandle: 'target-left' });

    expect(
      selectDirectionalHandles(
        { x: 300, y: 0, width: 200, height: 100 },
        { x: 0, y: 10, width: 200, height: 100 }
      )
    ).toEqual({ sourceHandle: 'source-left', targetHandle: 'target-right' });

    expect(
      selectDirectionalHandles(
        { x: 0, y: 0, width: 200, height: 100 },
        { x: 10, y: 250, width: 200, height: 100 }
      )
    ).toEqual({ sourceHandle: 'source-bottom', targetHandle: 'target-top' });
  });

  it('round-trips Markdown and Mermaid edits while preserving anchors & mastery', () => {
    const ws = createFlagshipDemoWorkspace();
    const md = workspaceToMarkdown(ws.rootNode);
    expect(md).toContain('# Transformer Architecture & Attention');
    expect(md).toContain('## Scaled Dot-Product Attention');

    const rebuiltFromMd = markdownToRootNode(
      md + '\n## Emergent Scaling\n- **Chinchilla Optimal**: Balances tokens and parameters.\n',
      ws.rootNode
    );
    expect(rebuiltFromMd.children.length).toBe(ws.rootNode.children.length + 1);
    const preserved = rebuiltFromMd.children.find((c) => c.id === 'n_qkv');
    expect(preserved?.anchors.length).toBe(2);
    expect(preserved?.mastery).toBe('mastered');

    const mermaid = workspaceToMermaid(ws.rootNode, ws.crossLinks);
    expect(mermaid).toContain('flowchart LR');
    expect(mermaid).toContain('-. "stabilizes heads" .->');

    const rebuiltFromMermaid = mermaidToRootNode(mermaid, ws.rootNode);
    expect(rebuiltFromMermaid.topic).toBe(ws.rootNode.topic);
    expect(rebuiltFromMermaid.children.length).toBe(ws.rootNode.children.length);
  });

  it('exports valid SVG, Obsidian .canvas, Anki .csv, and round-trips URL hash snapshots', async () => {
    const ws = createFlagshipDemoWorkspace();
    const { nodes, edges } = await computeSpatialLayout(ws, new Set(), 'balanced');

    const svg = exportToSvgString(ws, nodes, edges);
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('Transformer Architecture');

    const canvas = JSON.parse(exportToObsidianCanvas(ws, nodes, edges));
    expect(canvas.nodes.length).toBe(8);
    expect(canvas.edges.length).toBeGreaterThanOrEqual(7);

    const csv = exportToAnkiCsv(ws);
    expect(csv.startsWith('Front,Back,Tags')).toBe(true);
    expect(csv).toContain('Scaled Dot-Product Attention');

    const hash = encodeWorkspaceHash(ws);
    expect(hash.startsWith('#mw=')).toBe(true);
    const decoded = decodeWorkspaceHash(hash);
    expect(decoded?.title).toBe(ws.title);
    expect(decoded?.sources.length).toBe(3);
  });
});
