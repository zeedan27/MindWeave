import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MindMapWorkspaceSchema } from '@/lib/schemas';
import {
  createFlagshipDemoWorkspace,
  buildDeterministicWorkspaceFromSources,
  formatTimestampSec,
} from '@/lib/demo-workspace';
import {
  extractYouTubeId,
  extractFromText,
  sha256Hex,
} from '@/lib/ingestion/extractors';
import { GET as healthGet } from '@/app/api/healthz/[probe]/route';
import { POST as weavePost } from '@/app/api/weave/route';
import { resetRateLimitStore } from '@/lib/rate-limit';

describe('Slice 2: Multi-Source Ingestion, Flagship Demo Dataset & Weave API', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('validates the Flagship Demo Workspace against MindMapWorkspaceSchema', () => {
    const demo = createFlagshipDemoWorkspace();
    const parsed = MindMapWorkspaceSchema.safeParse(demo);
    expect(parsed.success).toBe(true);
    expect(demo.sources.length).toBe(3);
    expect(demo.crossLinks.length).toBeGreaterThanOrEqual(2);
    expect(demo.blindSpots.length).toBeGreaterThanOrEqual(2);
    expect(demo.walkthrough.length).toBeGreaterThanOrEqual(4);
  });

  it('extracts valid 11-char YouTube IDs and rejects invalid URLs', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=eMlx5fFNoYc')).toBe('eMlx5fFNoYc');
    expect(extractYouTubeId('https://youtu.be/eMlx5fFNoYc?t=120')).toBe('eMlx5fFNoYc');
    expect(extractYouTubeId('https://youtube.com/shorts/eMlx5fFNoYc')).toBe('eMlx5fFNoYc');
    expect(extractYouTubeId('eMlx5fFNoYc')).toBe('eMlx5fFNoYc');
    expect(extractYouTubeId('https://evil.example/payload')).toBeNull();
    expect(formatTimestampSec(252)).toBe('04:12');
    expect(formatTimestampSec(3661)).toBe('1:01:01');
  });

  it('chunks Markdown notes into heading-aware segments with SHA-256 hash', () => {
    const md = `# Overview\nTransformers use self-attention to connect tokens globally in one step.\n\n## Scaling\nCompute optimal training balances model parameters and dataset tokens.`;
    const doc = extractFromText(md, 'Scaling Notes', 'text', 'scaling.md');
    expect(doc.rawTextHash).toBe(sha256Hex(md));
    expect(doc.segments.length).toBe(2);
    expect(doc.segments[0].heading).toBe('Overview');
    expect(doc.segments[1].heading).toBe('Scaling');
  });

  it('synthesizes multiple sources deterministically offline', () => {
    const s1 = extractFromText('# Core Idea\nAttention connects all tokens in parallel.', 'Paper', 'text', 'paper.md');
    const s2 = extractFromText('Explain FlashAttention IO tiling for long sequences.', 'FlashAttention', 'topic');
    const ws = buildDeterministicWorkspaceFromSources([s1, s2]);
    expect(MindMapWorkspaceSchema.safeParse(ws).success).toBe(true);
    expect(ws.rootNode.children.length).toBe(2);
    expect(ws.crossLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('serves /api/healthz/live and /api/healthz/ready and weaves JSON sources offline', async () => {
    const liveRes = await healthGet(new NextRequest('http://localhost/api/healthz/live'), {
      params: Promise.resolve({ probe: 'live' }),
    });
    expect(liveRes.status).toBe(200);

    const readyRes = await healthGet(new NextRequest('http://localhost/api/healthz/ready'), {
      params: Promise.resolve({ probe: 'ready' }),
    });
    expect(readyRes.status).toBe(200);

    const req = new NextRequest('http://localhost/api/weave', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sources: [
          { type: 'topic', content: 'Quantum Error Correction' },
          { type: 'text', title: 'Notes', content: '# Surface Codes\nStabilizer measurements detect bit and phase flips without collapsing encoded logical qubits.' },
        ],
      }),
    });
    const res = await weavePost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(MindMapWorkspaceSchema.safeParse(json.data.workspace).success).toBe(true);
  });
});
