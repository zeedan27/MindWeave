import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFlagshipDemoWorkspace } from '@/lib/demo-workspace';
import { computeSpatialLayout } from '@/lib/layout/spatial-engine';
import { markdownToRootNode, workspaceToMarkdown } from '@/lib/sync/markdown-mermaid';
import { exportToAnkiCsv, exportToObsidianCanvas, exportToSvgString } from '@/lib/export/exporters';
import { POST as expandPost } from '@/app/api/expand/route';
import { POST as lensPost } from '@/app/api/lens/route';
import { POST as blindspotsPost } from '@/app/api/blindspots/route';
import { POST as studyEvaluatePost } from '@/app/api/study/evaluate/route';
import { resetRateLimitStore } from '@/lib/rate-limit';

describe('Slice 7: End-to-End Workspace Cognitive Lifecycle Integration', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('completes full multi-source -> layout -> expand -> lens -> blindspot -> Feynman -> sync -> export cycle', async () => {
    const ws = createFlagshipDemoWorkspace();

    // 1. Expand a node
    const expandRes = await expandPost(
      new NextRequest('http://localhost/api/expand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceTitle: ws.title,
          node: { id: 'n_mha', topic: 'Multi-Head Subspaces', summary: 'Parallel heads' },
          siblingTopics: ['Scaled Dot-Product Attention'],
          ancestorTopics: [ws.rootNode.topic],
          sourceSegments: ws.sources[0].segments,
        }),
      })
    );
    const expandJson = await expandRes.json();
    expect(expandJson.ok).toBe(true);
    expect(expandJson.data.children.length).toBeGreaterThanOrEqual(2);

    // 2. Apply First-Principles lens
    const lensRes = await lensPost(
      new NextRequest('http://localhost/api/lens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceTitle: ws.title,
          node: { id: 'n_mha', topic: 'Multi-Head Subspaces', summary: 'Parallel heads' },
          lensType: 'first_principles',
        }),
      })
    );
    const lensJson = await lensRes.json();
    expect(lensJson.ok).toBe(true);
    expect(lensJson.data.lensCard.type).toBe('first_principles');

    // 3. Scan Blind Spots
    const bsRes = await blindspotsPost(
      new NextRequest('http://localhost/api/blindspots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceTitle: ws.title,
          nodesOutline: [
            { id: 'root', parentId: null, topic: ws.rootNode.topic, summary: ws.rootNode.summary },
            { id: 'n_mha', parentId: 'root', topic: 'Multi-Head Subspaces', summary: 'Parallel heads' },
          ],
          existingCrossLinks: ws.crossLinks,
        }),
      })
    );
    const bsJson = await bsRes.json();
    expect(bsJson.ok).toBe(true);
    expect(bsJson.data.blindSpots.length).toBeGreaterThanOrEqual(2);

    // 4. Evaluate Feynman explanation
    const evalRes = await studyEvaluatePost(
      new NextRequest('http://localhost/api/study/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'feynman',
          node: {
            id: 'n_mha',
            topic: 'Multi-Head Subspaces',
            summary: 'Splits embeddings into h parallel projection heads before W_O output projection.',
            childrenTopics: ['Head Concatenation & W_O'],
          },
          userAnswer: 'Each head projects embeddings into a smaller subspace in parallel, then concatenates outputs through W_O.',
        }),
      })
    );
    const evalJson = await evalRes.json();
    expect(evalJson.ok).toBe(true);
    expect(evalJson.data.score).toBeGreaterThanOrEqual(60);

    // 5. Bi-directional Markdown edit + 4-mode ELK layout + Exports
    const updatedRoot = markdownToRootNode(
      workspaceToMarkdown(ws.rootNode) + '\n## Positional Encodings\n- **RoPE**: Rotary phase embeddings.\n',
      ws.rootNode
    );
    const nextWs = { ...ws, rootNode: updatedRoot };

    const { nodes, edges } = await computeSpatialLayout(nextWs, new Set(), 'logic_tree');
    expect(nodes.length).toBe(10);
    expect(exportToSvgString(nextWs, nodes, edges)).toContain('Positional Encodings');
    expect(JSON.parse(exportToObsidianCanvas(nextWs, nodes, edges)).nodes.length).toBe(10);
    expect(exportToAnkiCsv(nextWs)).toContain('Positional Encodings');
  });
});
