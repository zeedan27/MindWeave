import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { resetRateLimitStore } from '@/lib/rate-limit';
import { POST as expandPost } from '@/app/api/expand/route';
import { POST as lensPost } from '@/app/api/lens/route';
import { POST as blindspotsPost } from '@/app/api/blindspots/route';
import { POST as studyEvaluatePost } from '@/app/api/study/evaluate/route';
import { POST as chatPost } from '@/app/api/chat/route';

describe('Slice 3: Cognitive Graph APIs (Expand, Lenses, BlindSpots, Study, Chat)', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('expands a node with non-duplicate children and source anchors', async () => {
    const req = new NextRequest('http://localhost/api/expand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceTitle: 'Transformers',
        node: { id: 'n_qkv', topic: 'Scaled Attention', summary: 'Dot product attention' },
        siblingTopics: ['Multi-Head Subspaces'],
        ancestorTopics: ['Transformers'],
        sourceSegments: [
          { id: 's1', sourceId: 'src1', index: 0, text: 'Scaled attention divides dot products by sqrt(d_k).', pageNumber: 3 },
        ],
      }),
    });
    const res = await expandPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.children.length).toBeGreaterThanOrEqual(2);
    expect(json.data.children[0].anchors.length).toBe(1);
  });

  it('applies contextual lenses including code_math KaTeX/Code/Mermaid', async () => {
    const req = new NextRequest('http://localhost/api/lens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceTitle: 'Transformers',
        node: { id: 'n_qkv', topic: 'Scaled Attention', summary: 'Softmax scaling' },
        lensType: 'code_math',
      }),
    });
    const res = await lensPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.lensCard.type).toBe('code_math');
    expect(json.data.lensCard.mathLatex).toBeTruthy();
    expect(json.data.lensCard.codeBlock.code).toBeTruthy();
    expect(json.data.lensCard.mermaidDiagram).toBeTruthy();
  });

  it('detects structural blind spots and suggested cross-links', async () => {
    const req = new NextRequest('http://localhost/api/blindspots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceTitle: 'Transformers',
        nodesOutline: [
          { id: 'root', parentId: null, topic: 'Transformers', summary: 'Root' },
          { id: 'b1', parentId: 'root', topic: 'Self-Attention', summary: 'Token mixing' },
          { id: 'b2', parentId: 'root', topic: 'Feed Forward', summary: 'MLP layers' },
        ],
        existingCrossLinks: [],
      }),
    });
    const res = await blindspotsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.blindSpots.length).toBeGreaterThanOrEqual(2);
    expect(json.data.suggestedCrossLinks.length).toBe(1);
  });

  it('evaluates Feynman & Cloze study submissions with score and mastery state', async () => {
    const req = new NextRequest('http://localhost/api/study/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'feynman',
        node: {
          id: 'n_qkv',
          topic: 'Scaled Dot-Product Attention',
          summary: 'Queries match Keys divided by sqrt(d_k) before softmax weights Values',
          childrenTopics: ['Variance Scaling', 'Causal Masking'],
        },
        userAnswer:
          'Queries compare against keys, then we divide by sqrt of dk to keep variance stable before softmax multiplies values and causal masking blocks future tokens.',
      }),
    });
    const res = await studyEvaluatePost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.score).toBeGreaterThanOrEqual(70);
    expect(['mastered', 'partial']).toContain(json.data.mastery);
  });

  it('answers grounded Socratic chat queries with source citations', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Why do we divide by sqrt(d_k)?',
        workspaceTitle: 'Transformers',
        nodesOutline: [{ id: 'n_qkv', topic: 'Scaled Attention', summary: 'Softmax scaling' }],
        selectedNode: {
          id: 'n_qkv',
          topic: 'Scaled Attention',
          summary: 'Divides dot products by sqrt(d_k)',
          childrenTopics: ['Variance Scaling'],
        },
        sourceSegments: [
          {
            id: 'yt-1',
            sourceId: 'src_yt',
            index: 0,
            startSec: 1120,
            text: 'Dividing by sqrt(d_k) keeps dot-product variance near 1 so softmax gradients stay healthy.',
          },
        ],
      }),
    });
    const res = await chatPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.citations.length).toBe(1);
    expect(json.data.citations[0].label).toBe('▶ 18:40');
  });
});
