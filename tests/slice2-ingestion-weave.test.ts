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
  extractFromPdfBuffer,
  chunkTextIntoSegments,
  sha256Hex,
} from '@/lib/ingestion/extractors';
import { reconstructPagesLayout, type RawPdfPage } from '@/lib/ingestion/pdf-layout';
import {
  rankRelevantSegments,
  sampleStratifiedSegments,
} from '@/lib/ingestion/segment-ranker';
import type { SourceSegment } from '@/lib/schemas';
import { GET as healthGet } from '@/app/api/healthz/[probe]/route';
import { POST as weavePost } from '@/app/api/weave/route';
import { resetRateLimitStore } from '@/lib/rate-limit';

function buildSyntheticPdf(pageStreams: string[]): Buffer {
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, then per page (Page obj + Content stream obj)
  const pageIds: number[] = [];
  let nextId = 5;
  for (let i = 0; i < pageStreams.length; i += 1) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    const stream = pageStreams[i];
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let out = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let id = 1; id < nextId; id += 1) {
    offsets[id] = Buffer.byteLength(out, 'latin1');
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${nextId}\n0000000000 65535 f \n`;
  for (let id = 1; id < nextId; id += 1) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer << /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

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

  it('extracts valid text from PDFs without pageJoiner artifacts and rejects scanned/blank or corrupt PDFs', async () => {
    const validPdf =
      '%PDF-1.4\n' +
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n' +
      '4 0 obj << /Length 44 >> stream\n' +
      'BT /F1 12 Tf 72 720 Td (Hello MindWeave PDF) Tj ET\n' +
      'endstream endobj\n' +
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n' +
      'xref\n0 6\n' +
      '0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000334 00000 n \n' +
      'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n404\n%%EOF\n';
    const doc = await extractFromPdfBuffer(Buffer.from(validPdf, 'utf8'), 'hello.pdf');
    expect(doc.type).toBe('pdf');
    expect(doc.title).toBe('Hello MindWeave PDF');
    expect(doc.segments.length).toBe(1);
    expect(doc.segments[0].pageNumber).toBe(1);
    expect(doc.segments[0].text).toBe('Hello MindWeave PDF');
    expect(doc.segments[0].text).not.toContain('-- 1 of 1 --');

    const blankPdf =
      '%PDF-1.4\n' +
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n' +
      'xref\n0 4\n' +
      '0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      'trailer << /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n';
    await expect(
      extractFromPdfBuffer(Buffer.from(blankPdf, 'utf8'), 'scanned.pdf')
    ).rejects.toThrow(/scanned images or empty/i);

    const multiPageLowTextPdf = buildSyntheticPdf([
      'BT /F1 10 Tf 300 720 Td (i) Tj ET',
      'BT /F1 10 Tf 300 720 Td (ii) Tj ET',
    ]);
    await expect(
      extractFromPdfBuffer(multiPageLowTextPdf, 'scanned-2p.pdf')
    ).rejects.toThrow(/scanned images or empty/i);

    await expect(
      extractFromPdfBuffer(Buffer.from('not a pdf payload', 'utf8'), 'broken.pdf')
    ).rejects.toThrow(/invalid or corrupted pdf/i);
  });

  it('reconstructs two-column research paper reading order, detects headings, repairs hyphenation, and strips footers', async () => {
    // Interleave left (x=54) and right (x=324) columns on the same baseline in the stream,
    // plus full-width title/abstract at top and a bottom page number at y=20.
    const twoColStream = [
      'BT /F2 18 Tf 72 750 Td (Attention Mechanisms for Long-Context Reasoning) Tj ET',
      'BT /F1 10 Tf 72 720 Td (Abstract: We study sparse attention scaling across multi-thousand token documents and memory efficiency.) Tj ET',
      'BT /F2 12 Tf 54 670 Td (1. Introduction) Tj ET',
      'BT /F2 12 Tf 324 670 Td (2. Methodology) Tj ET',
      'BT /F1 10 Tf 54 650 Td (Sparse attention connects tokens with atten-) Tj ET',
      'BT /F1 10 Tf 324 650 Td (Tiled SRAM kernels avoid quadratic) Tj ET',
      'BT /F1 10 Tf 54 636 Td (tion weights across all positions while self-) Tj ET',
      'BT /F1 10 Tf 324 636 Td (buffers in high bandwidth GPU memory.) Tj ET',
      'BT /F1 10 Tf 54 622 Td (attention layers execute in parallel.) Tj ET',
      'BT /F1 10 Tf 324 622 Td (Benchmarks verify linear speedup.) Tj ET',
      'BT /F1 9 Tf 300 20 Td (1) Tj ET',
    ].join('\n');

    const pdfBuf = buildSyntheticPdf([twoColStream]);
    const doc = await extractFromPdfBuffer(pdfBuf, 'two-column-paper.pdf');

    expect(doc.title).toContain('Attention Mechanisms for Long-Context Reasoning');
    const combined = doc.segments.map((s) => `${s.heading || ''}: ${s.text}`).join('\n');

    const abstractIdx = combined.indexOf('Abstract: We study sparse attention');
    const introIdx = combined.indexOf('1. Introduction');
    const leftEndIdx = combined.indexOf('parallel.');
    const methodsIdx = combined.indexOf('2. Methodology');
    const rightStartIdx = combined.indexOf('Tiled SRAM kernels');

    expect(abstractIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThan(abstractIdx);
    expect(leftEndIdx).toBeGreaterThan(introIdx);
    expect(methodsIdx).toBeGreaterThan(leftEndIdx);
    expect(rightStartIdx).toBeGreaterThan(methodsIdx);

    // Hyphenation repair + compound hyphen preservation
    expect(combined).toContain('attention weights');
    expect(combined).toContain('self-attention layers');

    // Heading extraction populated on segments
    const headings = doc.segments.map((s) => s.heading).filter(Boolean);
    expect(headings).toContain('1. Introduction');
    expect(headings).toContain('2. Methodology');

    // Isolated page number stripped from bottom band
    expect(doc.segments.some((s) => s.text.trim() === '1')).toBe(false);
  });

  it('strips repeated headers/footers across >= 3 pages and preserves Markdown tables in chunkTextIntoSegments', () => {
    const rawPages: RawPdfPage[] = [1, 2, 3, 4].map((n) => ({
      pageNumber: n,
      width: 612,
      height: 792,
      items: [
        { str: 'Proceedings of Neural Systems 2026', x: 180, y: 24, width: 220, height: 9, fontName: 'F1', isBold: false },
        { str: `Body paragraph for page ${n} describing model convergence.`, x: 72, y: 120, width: 420, height: 10, fontName: 'F1', isBold: false },
        ...(n === 2
          ? [
              { str: 'Model', x: 72, y: 200, width: 40, height: 10, fontName: 'F2', isBold: true },
              { str: 'Params', x: 200, y: 200, width: 42, height: 10, fontName: 'F2', isBold: true },
              { str: 'Score', x: 320, y: 200, width: 38, height: 10, fontName: 'F2', isBold: true },
              { str: 'MindWeave-S', x: 72, y: 218, width: 70, height: 10, fontName: 'F1', isBold: false },
              { str: '7B', x: 200, y: 218, width: 20, height: 10, fontName: 'F1', isBold: false },
              { str: '91.4', x: 320, y: 218, width: 26, height: 10, fontName: 'F1', isBold: false },
            ]
          : []),
        { str: `Page ${n} of 4`, x: 270, y: 770, width: 60, height: 9, fontName: 'F1', isBold: false },
      ],
    }));

    const layout = reconstructPagesLayout(rawPages);
    expect(layout.fullText).not.toContain('Proceedings of Neural Systems');
    expect(layout.fullText).not.toContain('Page 1 of 4');
    expect(layout.pages[1].text).toContain('| Model | Params | Score |');
    expect(layout.pages[1].text).toContain('| --- | --- | --- |');
    expect(layout.pages[1].text).toContain('| MindWeave-S | 7B | 91.4 |');

    const chunked = chunkTextIntoSegments('src_tbl', layout.pages[1].text, 2, 0);
    const tableSeg = chunked.find((s) => s.text.includes('| Model | Params | Score |'));
    expect(tableSeg).toBeDefined();
    expect(tableSeg!.text).toContain('\n| --- | --- | --- |\n| MindWeave-S | 7B | 91.4 |');
  });

  it('samples stratified whole-document segments excluding References and ranks relevant late-paper segments', () => {
    const segments: SourceSegment[] = [];
    for (let i = 0; i < 80; i += 1) {
      if (i < 5) {
        segments.push({
          id: `seg-${i}`,
          sourceId: 'src_paper',
          index: i,
          pageNumber: 1,
          heading: i < 2 ? 'Abstract' : '1. Introduction',
          text: `Opening concept ${i} about long-context transformer architectures.`,
        });
      } else if (i === 35) {
        segments.push({
          id: `seg-${i}`,
          sourceId: 'src_paper',
          index: i,
          pageNumber: 9,
          heading: '4. Experimental Results',
          text: '| Model | Accuracy | Latency |\n| --- | --- | --- |\n| SparseTree | 94.8% | 12ms |',
        });
      } else if (i >= 57 && i < 60) {
        segments.push({
          id: `seg-${i}`,
          sourceId: 'src_paper',
          index: i,
          pageNumber: 15,
          heading: '6. Conclusion',
          text: `Final takeaway ${i} summarizing memory savings and downstream reasoning gains.`,
        });
      } else if (i >= 60) {
        segments.push({
          id: `seg-${i}`,
          sourceId: 'src_paper',
          index: i,
          pageNumber: 16 + Math.floor((i - 60) / 5),
          heading: 'References',
          text: `[${i}] Smith et al. (2024). Prior paper on attention. [${i + 1}] Doe et al. (2023).`,
        });
      } else {
        segments.push({
          id: `seg-${i}`,
          sourceId: 'src_paper',
          index: i,
          pageNumber: 2 + Math.floor(i / 4),
          heading: i < 30 ? '2. Methods' : '3. Architecture',
          text: `Technical body paragraph ${i} discussing projection heads and block sparsity.`,
        });
      }
    }

    const sampled = sampleStratifiedSegments(segments, 24);
    expect(sampled.length).toBeLessThanOrEqual(24);
    expect(sampled.some((s) => s.heading === 'References')).toBe(false);
    expect(sampled.some((s) => s.id === 'seg-0')).toBe(true);
    expect(sampled.some((s) => s.id === 'seg-35')).toBe(true);
    expect(sampled.some((s) => s.id === 'seg-59')).toBe(true);

    const ranked = rankRelevantSegments('experimental accuracy table results', segments, 5);
    expect(ranked.length).toBe(5);
    expect(ranked[0].id).toBe('seg-35');
    expect(ranked.some((s) => s.heading === 'References')).toBe(false);
  });
});
