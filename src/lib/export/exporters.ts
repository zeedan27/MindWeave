import type { MindMapNode, MindMapWorkspace } from '@/lib/schemas';
import type { SpatialFlowEdge, SpatialFlowNode } from '@/lib/layout/spatial-engine';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

export function exportToSvgString(
  workspace: MindMapWorkspace,
  flowNodes: SpatialFlowNode[],
  flowEdges: SpatialFlowEdge[]
): string {
  if (flowNodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"></svg>';
  }

  const padding = 72;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const boxLookup = new Map<string, { x: number; y: number; w: number; h: number }>();

  for (const fn of flowNodes) {
    const w = fn.data.width || 240;
    const h = fn.data.height || 100;
    boxLookup.set(fn.id, { x: fn.position.x, y: fn.position.y, w, h });
    minX = Math.min(minX, fn.position.x);
    minY = Math.min(minY, fn.position.y);
    maxX = Math.max(maxX, fn.position.x + w);
    maxY = Math.max(maxY, fn.position.y + h);
  }

  const width = Math.max(600, Math.round(maxX - minX + padding * 2));
  const height = Math.max(400, Math.round(maxY - minY + padding * 2));
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const edgeSvgs = flowEdges
    .map((edge) => {
      const s = boxLookup.get(edge.source);
      const t = boxLookup.get(edge.target);
      if (!s || !t) return '';
      const sx = s.x + s.w / 2 + offsetX;
      const sy = s.y + s.h / 2 + offsetY;
      const tx = t.x + t.w / 2 + offsetX;
      const ty = t.y + t.h / 2 + offsetY;
      const cx = (sx + tx) / 2;
      const isCross = edge.data?.kind === 'crosslink';
      const stroke = isCross ? '#1d4ed8' : '#7490a3';
      const dash = isCross ? ' stroke-dasharray="6 4"' : '';

      const path = `<path d="M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}" fill="none" stroke="${stroke}" stroke-width="${isCross ? 1.8 : 2}"${dash} opacity="0.82" />`;
      if (isCross && edge.data?.label) {
        const lx = (sx + tx) / 2;
        const ly = (sy + ty) / 2 - 6;
        return `${path}<text x="${lx}" y="${ly}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#1d4ed8">${escapeXml(edge.data.label)}</text>`;
      }
      return path;
    })
    .join('\n');

  const nodeSvgs = flowNodes
    .map((fn) => {
      const box = boxLookup.get(fn.id)!;
      const x = box.x + offsetX;
      const y = box.y + offsetY;
      const isRoot = fn.data.isRoot;
      const fill = isRoot ? '#0f5257' : '#ffffff';
      const stroke = isRoot ? '#0f5257' : '#aec3d2';
      const titleFill = isRoot ? '#ffffff' : '#141414';
      const bodyFill = isRoot ? '#d9ecef' : '#3f4756';

      const titleLines = wrapText(fn.data.node.topic, 26, 2);
      const summaryLines = wrapText(fn.data.node.summary || '', 34, 3);

      const titleSvg = titleLines
        .map(
          (line, idx) =>
            `<text x="${x + 14}" y="${y + 24 + idx * 17}" font-family="Schibsted Grotesk, sans-serif" font-size="14" font-weight="600" fill="${titleFill}">${escapeXml(line)}</text>`
        )
        .join('');

      const summaryStartY = y + 28 + titleLines.length * 17;
      const summarySvg = summaryLines
        .map(
          (line, idx) =>
            `<text x="${x + 14}" y="${summaryStartY + idx * 15}" font-family="Schibsted Grotesk, sans-serif" font-size="11.5" fill="${bodyFill}">${escapeXml(line)}</text>`
        )
        .join('');

      return `<g>
        <rect x="${x}" y="${y}" width="${box.w}" height="${box.h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
        ${titleSvg}
        ${summarySvg}
      </g>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#edf3f7" />
  <text x="24" y="34" font-family="Schibsted Grotesk, sans-serif" font-size="18" font-weight="600" fill="#141414">${escapeXml(workspace.title)}</text>
  <text x="24" y="54" font-family="JetBrains Mono, monospace" font-size="11" fill="#3f4756">MindWeave · ${workspace.sources.length} source(s) · ${workspace.layoutMode} layout</text>
  ${edgeSvgs}
  ${nodeSvgs}
</svg>`;
}

export function exportToObsidianCanvas(
  workspace: MindMapWorkspace,
  flowNodes: SpatialFlowNode[],
  flowEdges: SpatialFlowEdge[]
): string {
  const colorByLevel = ['4', '5', '6', '2', '3']; // Obsidian Canvas preset palette IDs (no violet)

  const nodes = flowNodes.map((fn) => {
    const anchorsText =
      fn.data.node.anchors.length > 0
        ? `\n\n**Sources:** ${fn.data.node.anchors.map((a) => `\`${a.label}\``).join(', ')}`
        : '';
    return {
      id: fn.id,
      type: 'text',
      x: Math.round(fn.position.x),
      y: Math.round(fn.position.y),
      width: Math.round(fn.data.width || 250),
      height: Math.round(fn.data.height || 120),
      color: colorByLevel[fn.data.node.level % colorByLevel.length],
      text: `### ${fn.data.node.topic}\n${fn.data.node.summary || ''}${anchorsText}`,
    };
  });

  const edges = flowEdges.map((edge) => ({
    id: edge.id,
    fromNode: edge.source,
    fromSide: edge.sourceHandle?.replace('source-', '') || 'right',
    toNode: edge.target,
    toSide: edge.targetHandle?.replace('target-', '') || 'left',
    ...(edge.data?.label ? { label: edge.data.label } : {}),
  }));

  return JSON.stringify(
    {
      nodes,
      edges,
      metadata: { exportedFrom: 'MindWeave', title: workspace.title },
    },
    null,
    2
  );
}

function escapeCsvCell(value: string): string {
  const clean = value.replace(/\r?\n/g, '<br>');
  if (clean.includes(',') || clean.includes('"') || clean.includes('<br>')) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

export function exportToAnkiCsv(workspace: MindMapWorkspace): string {
  const rows: string[] = ['Front,Back,Tags'];

  function walk(node: MindMapNode, pathTopics: string[]) {
    const currentPath = [...pathTopics, node.topic];
    if (node.level > 0) {
      const front = `${pathTopics.join(' › ')} → ${node.topic}`;
      const citations =
        node.anchors.length > 0
          ? `<br><br>Sources: ${node.anchors.map((a) => `[${a.label}] ${a.excerpt}`).join(' | ')}`
          : '';
      const childHint =
        node.children.length > 0
          ? `<br><br>Sub-concepts: ${node.children.map((c) => c.topic).join(', ')}`
          : '';
      const back = `${node.summary || node.topic}${childHint}${citations}`;
      const tag = workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      rows.push(`${escapeCsvCell(front)},${escapeCsvCell(back)},${escapeCsvCell(`mindweave ${tag}`)}`);
    }
    for (const child of node.children) {
      walk(child, currentPath);
    }
  }

  walk(workspace.rootNode, []);
  return rows.join('\n') + '\n';
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadSvg(
  workspace: MindMapWorkspace,
  flowNodes: SpatialFlowNode[],
  flowEdges: SpatialFlowEdge[]
): void {
  const svg = exportToSvgString(workspace, flowNodes, flowEdges);
  const slug = workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'mindweave';
  downloadTextFile(`${slug}.svg`, svg, 'image/svg+xml;charset=utf-8');
}

export async function downloadRetinaPng(
  workspace: MindMapWorkspace,
  flowNodes: SpatialFlowNode[],
  flowEdges: SpatialFlowEdge[]
): Promise<void> {
  const svg = exportToSvgString(workspace, flowNodes, flowEdges);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to rasterize SVG for PNG export'));
      image.src = svgUrl;
    });

    const scale = 4; // 4x Retina high-resolution export
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(8192, Math.max(1200, img.width * scale));
    canvas.height = Math.min(8192, Math.max(800, img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.fillStyle = '#edf3f7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG blob generation failed'))),
        'image/png'
      );
    });

    const pngUrl = URL.createObjectURL(pngBlob);
    const slug =
      workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'mindweave';
    const anchor = document.createElement('a');
    anchor.href = pngUrl;
    anchor.download = `${slug}-4x.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
