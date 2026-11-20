export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  isBold: boolean;
}

export interface RawPdfPage {
  pageNumber: number;
  width: number;
  height: number;
  items: PositionedTextItem[];
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  meaningfulCharCount: number;
}

export interface ExtractedPdfDocument {
  pages: ExtractedPdfPage[];
  fullText: string;
  totalMeaningfulChars: number;
  medianFontSize: number;
}

interface VisualLine {
  text: string;
  x: number;
  endX: number;
  y: number;
  height: number;
  isBold: boolean;
  bandIndex: number;
}

type ColumnZone = 'full' | 'left' | 'right';

interface LayoutBlock {
  kind: 'line' | 'table';
  text: string;
  x: number;
  endX: number;
  y: number;
  endY: number;
  height: number;
  isBold: boolean;
  bandIndex: number;
  columnZone?: ColumnZone;
}

const COMPOUND_PREFIXES = new Set([
  'self',
  'multi',
  'cross',
  'pre',
  'post',
  'sub',
  'non',
  'co',
  're',
  'anti',
  'inter',
  'intra',
  'semi',
  'meta',
  'high',
  'low',
  'long',
  'short',
  'real',
  'end',
  'open',
  'well',
  'two',
  'one',
  'three',
  'state',
  'fine',
  'zero',
  'few',
  'in',
  'out',
  'up',
  'down',
  'full',
  'half',
  'mid',
  'left',
  'right',
  'top',
  'bottom',
]);

const CANONICAL_SECTION_REGEX =
  /^(?:abstract|introduction|background|related\s+work|methodology|methods?|materials?\s+and\s+methods?|approach|architecture|experiments?|experimental\s+setup|evaluation|results?|discussion|limitations?|conclusion|conclusions?|future\s+work|acknowledg(?:e)?ments?|references|bibliography|appendix(?:\s+[a-z0-9]+)?)$/i;

const NUMBERED_HEADING_REGEX =
  /^(?:\d+(?:\.\d+){0,3}\.?|[IVX]{1,5}\.)\s+[A-Z][^\n]{1,100}$/;

const PAGE_NUMBER_REGEX =
  /^(?:(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?|[-–—]\s*\d{1,4}\s*[-–—])$/i;

/**
 * Strips illegal ASCII control characters (keeping tab, LF, CR) and lone UTF-16 surrogates.
 */
export function sanitizePdfString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < raw.length ? raw.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += raw[i] + raw[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }
    out += raw[i];
  }
  return out;
}

/**
 * Counts Unicode letters and numbers to distinguish real content from whitespace/punctuation.
 */
export function countMeaningfulChars(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

/**
 * Extracts raw viewport-positioned text items from a PDF buffer using pdfjs-dist.
 */
export async function extractRawPdfPages(buffer: Buffer): Promise<RawPdfPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']> | null = null;

  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
    });
    doc = await loadingTask.promise;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'PasswordException') {
        throw new Error('This PDF is password-protected and cannot be read.');
      }
      if (err.name === 'InvalidPDFException' || err.name === 'FormatError') {
        throw new Error('Invalid or corrupted PDF file.');
      }
    }
    throw err;
  }

  const pages: RawPdfPage[] = [];
  try {
    const totalPages = Math.min(doc.numPages, 250);
    for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        const viewport = page.getViewport({ scale: 1 });
        try {
          await page.getOperatorList();
        } catch {
          // Non-text operator warnings should not block text extraction
        }
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });

        const fontMeta = new Map<string, { name: string; isBold: boolean }>();
        for (const fontKey of Object.keys(textContent.styles || {})) {
          const obj = page.commonObjs.has(fontKey)
            ? (page.commonObjs.get(fontKey) as {
                name?: string;
                bold?: boolean;
                black?: boolean;
              } | null)
            : null;
          const name = typeof obj?.name === 'string' ? obj.name : '';
          const isBold = Boolean(
            obj?.bold || obj?.black || /bold|black|heavy|demi|cmbx|bx\d/i.test(name)
          );
          fontMeta.set(fontKey, { name, isBold });
        }

        const items: PositionedTextItem[] = [];
        for (const rawItem of textContent.items) {
          if (!('str' in rawItem)) continue;
          const cleanStr = sanitizePdfString(rawItem.str);
          // Skip whitespace-only pdfjs spacer items whose width can bridge column gutters
          if (!cleanStr.trim()) continue;

          const tm = rawItem.transform;
          const [vx, vy] = viewport.convertToViewportPoint(tm[4], tm[5]);
          const scaleH = Math.hypot(tm[2], tm[3]);
          const height =
            rawItem.height > 0 ? rawItem.height : scaleH > 0 ? scaleH : 10;
          const width =
            rawItem.width > 0
              ? rawItem.width
              : Math.max(height * 0.5 * cleanStr.length, 1);
          const meta = fontMeta.get(rawItem.fontName);

          items.push({
            str: cleanStr,
            x: vx,
            y: vy,
            width,
            height,
            fontName: meta?.name || rawItem.fontName || '',
            isBold: Boolean(meta?.isBold),
          });
        }

        pages.push({
          pageNumber: pageNum,
          width: viewport.width,
          height: viewport.height,
          items,
        });
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }

  return pages;
}

/**
 * Computes the character-weighted median body font height across the document.
 */
export function computeMedianFontSize(pages: RawPdfPage[]): number {
  const buckets = new Map<number, number>();
  let totalChars = 0;

  for (const page of pages) {
    for (const item of page.items) {
      if (item.height < 4 || item.height > 48) continue;
      const weight = Math.max(1, item.str.trim().length);
      const bucket = Math.round(item.height * 2) / 2;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + weight);
      totalChars += weight;
    }
  }

  if (totalChars === 0) return 10;

  const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
  const target = totalChars * 0.5;
  let seen = 0;
  for (const [size, count] of sorted) {
    seen += count;
    if (seen >= target) return size;
  }
  return 10;
}

function normalizeMarginText(items: PositionedTextItem[]): string {
  if (items.length === 0) return '';
  return [...items]
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str.trim())
    .join(' ')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function rawMarginText(items: PositionedTextItem[]): string {
  if (items.length === 0) return '';
  return [...items]
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes running headers, footers, and isolated page numbers inside top/bottom 6% page bands.
 */
export function stripRunningHeadersAndFooters(pages: RawPdfPage[]): RawPdfPage[] {
  const topCounts = new Map<string, number>();
  const bottomCounts = new Map<string, number>();

  const perPageBands = pages.map((page) => {
    const topThreshold = page.height * 0.065;
    const bottomThreshold = page.height * 0.94;
    const topItems: PositionedTextItem[] = [];
    const bottomItems: PositionedTextItem[] = [];

    for (const item of page.items) {
      if (item.y - item.height * 0.5 <= page.height * 0.06 || item.y <= topThreshold) {
        topItems.push(item);
      } else if (item.y >= bottomThreshold) {
        bottomItems.push(item);
      }
    }

    const topNorm = normalizeMarginText(topItems);
    const bottomNorm = normalizeMarginText(bottomItems);
    if (topNorm) topCounts.set(topNorm, (topCounts.get(topNorm) ?? 0) + 1);
    if (bottomNorm) bottomCounts.set(bottomNorm, (bottomCounts.get(bottomNorm) ?? 0) + 1);

    return {
      page,
      topSet: new Set(topItems),
      bottomSet: new Set(bottomItems),
      topNorm,
      bottomNorm,
      topRaw: rawMarginText(topItems),
      bottomRaw: rawMarginText(bottomItems),
    };
  });

  const hasEnoughPagesForRepeat = pages.length >= 3;

  return perPageBands.map(
    ({ page, topSet, bottomSet, topNorm, bottomNorm, topRaw, bottomRaw }) => {
      const stripTop =
        Boolean(topRaw) &&
        (PAGE_NUMBER_REGEX.test(topRaw) ||
          (hasEnoughPagesForRepeat && (topCounts.get(topNorm) ?? 0) >= 3));
      const stripBottom =
        Boolean(bottomRaw) &&
        (PAGE_NUMBER_REGEX.test(bottomRaw) ||
          (hasEnoughPagesForRepeat && (bottomCounts.get(bottomNorm) ?? 0) >= 3));

      if (!stripTop && !stripBottom) return page;

      return {
        ...page,
        items: page.items.filter(
          (item) => !(stripTop && topSet.has(item)) && !(stripBottom && bottomSet.has(item))
        ),
      };
    }
  );
}

function groupIntoVisualLines(items: PositionedTextItem[]): VisualLine[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands: PositionedTextItem[][] = [];

  for (const item of sorted) {
    const lastBand = bands[bands.length - 1];
    if (!lastBand) {
      bands.push([item]);
      continue;
    }
    const anchor = lastBand[0];
    const yTol = Math.max(2, 0.4 * Math.max(item.height, anchor.height));
    if (Math.abs(item.y - anchor.y) <= yTol) {
      lastBand.push(item);
    } else {
      bands.push([item]);
    }
  }

  const lines: VisualLine[] = [];

  bands.forEach((band, bandIndex) => {
    const byX = [...band].sort((a, b) => a.x - b.x);
    let currentItems: PositionedTextItem[] = [byX[0]];
    let prevEndX = byX[0].x + byX[0].width;
    let prevHeight = byX[0].height;

    const flushSegment = (segItems: PositionedTextItem[]) => {
      let text = '';
      let segEndX = segItems[0].x + segItems[0].width;
      let totalWeight = 0;
      let weightedHeight = 0;
      let weightedY = 0;
      let boldWeight = 0;

      for (let i = 0; i < segItems.length; i += 1) {
        const it = segItems[i];
        const len = Math.max(1, it.str.trim().length);
        totalWeight += len;
        weightedHeight += it.height * len;
        weightedY += it.y * len;
        if (it.isBold) boldWeight += len;

        if (i === 0) {
          text = it.str;
          segEndX = it.x + it.width;
        } else {
          const prev = segItems[i - 1];
          const gap = it.x - (prev.x + prev.width);
          const spaceThresh = Math.max(1.2, Math.max(prev.height, it.height) * 0.16);
          const needsSpace =
            !text.endsWith(' ') && !it.str.startsWith(' ') && gap > spaceThresh;
          text += (needsSpace ? ' ' : '') + it.str;
          segEndX = Math.max(segEndX, it.x + it.width);
        }
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      lines.push({
        text: trimmed,
        x: segItems[0].x,
        endX: segEndX,
        y: weightedY / totalWeight,
        height: weightedHeight / totalWeight,
        isBold: totalWeight > 0 && boldWeight / totalWeight >= 0.6,
        bandIndex,
      });
    };

    for (let i = 1; i < byX.length; i += 1) {
      const next = byX[i];
      const gap = next.x - prevEndX;
      const gutterSplitThreshold = Math.max(12, 2.5 * Math.max(prevHeight, next.height));

      if (gap > gutterSplitThreshold) {
        flushSegment(currentItems);
        currentItems = [next];
      } else {
        currentItems.push(next);
      }
      prevEndX = Math.max(prevEndX, next.x + next.width);
      prevHeight = Math.max(prevHeight, next.height);
    }

    flushSegment(currentItems);
  });

  return lines;
}

const NUMERIC_CELL_REGEX = /\d|%|±/;
const COMPACT_TABLE_CELL_REGEX =
  /\d|%|±|\b(?:n\/a|yes|no|true|false|model|metric|score|method|dataset|name|type|value|param|accuracy|latency|cost)\b|^[A-Za-z0-9._-]{1,18}$/i;

function isMultiCellTableCandidate(cells: VisualLine[], pageWidth: number): boolean {
  if (cells.length >= 3) return true;
  if (cells.length !== 2) return false;

  const bothCompact = cells.every(
    (c) => c.endX - c.x < pageWidth * 0.36 && c.text.length <= 45
  );
  if (!bothCompact) return false;

  return cells.some((c) => COMPACT_TABLE_CELL_REGEX.test(c.text));
}

function buildMarkdownTableFromRows(rows: VisualLine[][], colAnchors: number[]): string {
  const numCols = colAnchors.length;
  const escapeCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

  const matrix = rows.map((row) => {
    const slots = new Array<string>(numCols).fill('');
    for (const cell of row) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < numCols; i += 1) {
        const dist = Math.abs(cell.x - colAnchors[i]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      slots[bestIdx] = slots[bestIdx]
        ? `${slots[bestIdx]} ${escapeCell(cell.text)}`
        : escapeCell(cell.text);
    }
    return slots;
  });

  const formatRow = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const separator = `| ${new Array(numCols).fill('---').join(' | ')} |`;

  return [formatRow(matrix[0]), separator, ...matrix.slice(1).map(formatRow)].join('\n');
}

function tryConvertRunToTableBlock(
  rows: VisualLine[][],
  medianFontSize: number
): LayoutBlock | null {
  const threeColRows = rows.filter((r) => r.length >= 3).length;
  const twoColNumericRows = rows.filter((r) =>
    r.some((c) => NUMERIC_CELL_REGEX.test(c.text))
  ).length;

  const isThreeColTable = threeColRows >= 2;
  const isTwoColTable = rows.length >= 3 && twoColNumericRows >= Math.ceil(rows.length * 0.5);
  if (!isThreeColTable && !isTwoColTable) return null;

  // Cluster cell x-starts within +-14pt to find column stops
  const allXs = rows.flatMap((r) => r.map((c) => c.x)).sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const x of allXs) {
    const last = anchors[anchors.length - 1];
    if (last === undefined || x - last > 14) {
      anchors.push(x);
    }
  }

  if (anchors.length < 2) return null;

  const alignedRows = rows.filter((r) =>
    r.every((c) => anchors.some((a) => Math.abs(c.x - a) <= 18))
  ).length;
  if (alignedRows < 2) return null;

  const flat = rows.flat();
  const minX = Math.min(...flat.map((c) => c.x));
  const maxEndX = Math.max(...flat.map((c) => c.endX));
  const minY = Math.min(...flat.map((c) => c.y));
  const maxY = Math.max(...flat.map((c) => c.y));

  return {
    kind: 'table',
    text: buildMarkdownTableFromRows(rows, anchors),
    x: minX,
    endX: maxEndX,
    y: minY,
    endY: maxY,
    height: medianFontSize,
    isBold: false,
    bandIndex: flat[0].bandIndex,
  };
}

function extractTablesAndBlocks(
  lines: VisualLine[],
  pageWidth: number,
  medianFontSize: number
): LayoutBlock[] {
  if (lines.length === 0) return [];

  const rowGroups: VisualLine[][] = [];
  let curBand = -1;
  for (const line of lines) {
    if (line.bandIndex !== curBand) {
      rowGroups.push([line]);
      curBand = line.bandIndex;
    } else {
      rowGroups[rowGroups.length - 1].push(line);
    }
  }

  const blocks: LayoutBlock[] = [];
  let i = 0;

  while (i < rowGroups.length) {
    if (!isMultiCellTableCandidate(rowGroups[i], pageWidth)) {
      for (const cell of rowGroups[i]) {
        blocks.push({
          kind: 'line',
          text: cell.text,
          x: cell.x,
          endX: cell.endX,
          y: cell.y,
          endY: cell.y,
          height: cell.height,
          isBold: cell.isBold,
          bandIndex: cell.bandIndex,
        });
      }
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < rowGroups.length && isMultiCellTableCandidate(rowGroups[j], pageWidth)) {
      const prevY = rowGroups[j - 1][0].y;
      const nextY = rowGroups[j][0].y;
      if (nextY - prevY > medianFontSize * 3.0) break;
      j += 1;
    }

    const tableBlock = tryConvertRunToTableBlock(rowGroups.slice(i, j), medianFontSize);
    if (tableBlock) {
      blocks.push(tableBlock);
    } else {
      for (let k = i; k < j; k += 1) {
        for (const cell of rowGroups[k]) {
          blocks.push({
            kind: 'line',
            text: cell.text,
            x: cell.x,
            endX: cell.endX,
            y: cell.y,
            endY: cell.y,
            height: cell.height,
            isBold: cell.isBold,
            bandIndex: cell.bandIndex,
          });
        }
      }
    }
    i = j;
  }

  return blocks;
}

function orderPageBlocks(blocks: LayoutBlock[], pageWidth: number): LayoutBlock[] {
  if (blocks.length === 0) return [];

  const bandCounts = new Map<number, number>();
  for (const b of blocks) {
    bandCounts.set(b.bandIndex, (bandCounts.get(b.bandIndex) ?? 0) + 1);
  }

  const isFullWidth = (b: LayoutBlock): boolean => {
    if (b.x < pageWidth * 0.45 && b.endX > pageWidth * 0.55) return true;
    const isStandaloneLine = b.kind === 'line' && (bandCounts.get(b.bandIndex) ?? 0) === 1;
    if (isStandaloneLine) {
      const center = (b.x + b.endX) / 2;
      if (
        Math.abs(center - pageWidth / 2) < pageWidth * 0.12 &&
        b.x < pageWidth * 0.55 &&
        b.endX > pageWidth * 0.45
      ) {
        return true;
      }
    }
    return false;
  };

  const nonFullWidth = blocks.filter((b) => !isFullWidth(b));
  const sortByReading = (a: LayoutBlock, b: LayoutBlock) => a.y - b.y || a.x - b.x;

  if (nonFullWidth.length < 4) {
    return [...blocks].sort(sortByReading).map((b) => ({ ...b, columnZone: 'full' }));
  }

  let bestSplitX = pageWidth * 0.5;
  let bestCrossing = Infinity;
  let bestBalance = -1;

  for (let frac = 0.38; frac <= 0.6201; frac += 0.01) {
    const sx = pageWidth * frac;
    let crossing = 0;
    let leftCount = 0;
    let rightCount = 0;
    for (const b of nonFullWidth) {
      if (b.x < sx - 4 && b.endX > sx + 4) {
        crossing += 1;
      } else if ((b.x + b.endX) / 2 < sx) {
        leftCount += 1;
      } else {
        rightCount += 1;
      }
    }
    const balance = Math.min(leftCount, rightCount);
    if (
      crossing < bestCrossing ||
      (crossing === bestCrossing && balance > bestBalance)
    ) {
      bestCrossing = crossing;
      bestBalance = balance;
      bestSplitX = sx;
    }
  }

  const leftAll = nonFullWidth.filter(
    (b) => !(b.x < bestSplitX - 4 && b.endX > bestSplitX + 4) && (b.x + b.endX) / 2 < bestSplitX
  );
  const rightAll = nonFullWidth.filter(
    (b) => !(b.x < bestSplitX - 4 && b.endX > bestSplitX + 4) && (b.x + b.endX) / 2 >= bestSplitX
  );

  let isTwoColumn = false;
  if (
    leftAll.length >= 2 &&
    rightAll.length >= 2 &&
    bestCrossing <= Math.max(1, Math.floor(nonFullWidth.length * 0.1))
  ) {
    const minLeftY = Math.min(...leftAll.map((b) => b.y));
    const maxLeftY = Math.max(...leftAll.map((b) => b.endY));
    const minRightY = Math.min(...rightAll.map((b) => b.y));
    const maxRightY = Math.max(...rightAll.map((b) => b.endY));
    const verticalOverlap = minLeftY < maxRightY && minRightY < maxLeftY;

    const sortedLeftEndX = leftAll.map((b) => b.endX).sort((a, b) => a - b);
    const sortedRightX = rightAll.map((b) => b.x).sort((a, b) => a - b);
    const p90LeftEndX =
      sortedLeftEndX[
        Math.min(sortedLeftEndX.length - 1, Math.floor((sortedLeftEndX.length - 1) * 0.9))
      ];
    const p10RightX = sortedRightX[Math.floor((sortedRightX.length - 1) * 0.1)];
    const gutterWidth = p10RightX - p90LeftEndX;

    if (verticalOverlap && gutterWidth >= 6) {
      isTwoColumn = true;
    }
  }

  if (!isTwoColumn) {
    return [...blocks].sort(sortByReading).map((b) => ({ ...b, columnZone: 'full' }));
  }

  const ySorted = [...blocks].sort(sortByReading);
  const ordered: LayoutBlock[] = [];
  let zoneBlocks: LayoutBlock[] = [];

  const flushZone = () => {
    if (zoneBlocks.length === 0) return;
    const leftZone = zoneBlocks
      .filter((b) => (b.x + b.endX) / 2 < bestSplitX)
      .sort(sortByReading)
      .map((b) => ({ ...b, columnZone: 'left' as const }));
    const rightZone = zoneBlocks
      .filter((b) => (b.x + b.endX) / 2 >= bestSplitX)
      .sort(sortByReading)
      .map((b) => ({ ...b, columnZone: 'right' as const }));
    ordered.push(...leftZone, ...rightZone);
    zoneBlocks = [];
  };

  for (const block of ySorted) {
    if (isFullWidth(block)) {
      flushZone();
      ordered.push({ ...block, columnZone: 'full' });
    } else {
      zoneBlocks.push(block);
    }
  }
  flushZone();

  return ordered;
}

function isHeadingBlock(block: LayoutBlock, medianFontSize: number): boolean {
  if (block.kind !== 'line') return false;
  const text = block.text.trim();
  if (text.length < 2 || text.length > 140) return false;
  if (!/[a-zA-Z]/.test(text)) return false;

  if (block.height >= medianFontSize * 1.15 && text.length <= 120) {
    return true;
  }
  if (block.isBold && text.length <= 100 && !/[.,;:]$/.test(text)) {
    return true;
  }
  if (
    NUMBERED_HEADING_REGEX.test(text) &&
    text.length <= 95 &&
    !/[;,!?]$/.test(text) &&
    !(text.endsWith('.') && text.split(/\s+/).length > 7)
  ) {
    return true;
  }
  if (CANONICAL_SECTION_REGEX.test(text)) {
    return true;
  }
  return false;
}

function appendLineWithHyphenRepair(paragraph: string, nextLine: string): string {
  if (!paragraph) return nextLine;
  if (/[a-z]-$/.test(paragraph) && /^[a-z]/.test(nextLine)) {
    const stemMatch = paragraph.match(/([a-zA-Z]+)-$/);
    const stem = stemMatch ? stemMatch[1].toLowerCase() : '';
    if (COMPOUND_PREFIXES.has(stem)) {
      return `${paragraph}${nextLine}`;
    }
    return `${paragraph.slice(0, -1)}${nextLine}`;
  }
  return `${paragraph} ${nextLine}`;
}

function assemblePageMarkdown(orderedBlocks: LayoutBlock[], medianFontSize: number): string {
  const parts: string[] = [];
  let currentParagraph = '';
  let prevY = -Infinity;
  let prevZone: ColumnZone | undefined;

  const flushParagraph = () => {
    const clean = currentParagraph.trim();
    currentParagraph = '';
    if (clean) parts.push(clean);
  };

  for (const block of orderedBlocks) {
    if (block.kind === 'table') {
      flushParagraph();
      parts.push(block.text);
      prevY = block.endY;
      prevZone = block.columnZone;
      continue;
    }

    if (isHeadingBlock(block, medianFontSize)) {
      flushParagraph();
      parts.push(`## ${block.text.trim()}`);
      prevY = block.y;
      prevZone = block.columnZone;
      continue;
    }

    const lineText = block.text.trim();
    const zoneChanged = prevZone !== undefined && block.columnZone !== prevZone;
    const verticalGap = prevY === -Infinity ? 0 : block.y - prevY;
    const largeVerticalGap = verticalGap > medianFontSize * 1.85;
    const isBullet = /^[-•*]\s+/.test(lineText);

    if (zoneChanged || largeVerticalGap || isBullet) {
      flushParagraph();
    }

    currentParagraph = appendLineWithHyphenRepair(currentParagraph, lineText);
    prevY = block.y;
    prevZone = block.columnZone;
  }

  flushParagraph();
  return parts.join('\n\n');
}

/**
 * Reconstructs clean reading-order Markdown text (with headings and tables preserved)
 * from coordinate-positioned PDF page items.
 */
export function reconstructPagesLayout(pages: RawPdfPage[]): ExtractedPdfDocument {
  const medianFontSize = computeMedianFontSize(pages);
  const cleanedPages = stripRunningHeadersAndFooters(pages);

  const extractedPages: ExtractedPdfPage[] = cleanedPages.map((page) => {
    const lines = groupIntoVisualLines(page.items);
    const blocks = extractTablesAndBlocks(lines, page.width, medianFontSize);
    const ordered = orderPageBlocks(blocks, page.width);
    const text = assemblePageMarkdown(ordered, medianFontSize).trim();
    return {
      pageNumber: page.pageNumber,
      text,
      meaningfulCharCount: countMeaningfulChars(text),
    };
  });

  const fullText = extractedPages
    .map((p) => p.text)
    .filter((t) => t.length > 0)
    .join('\n\n');

  const totalMeaningfulChars = extractedPages.reduce(
    (sum, p) => sum + p.meaningfulCharCount,
    0
  );

  return {
    pages: extractedPages,
    fullText,
    totalMeaningfulChars,
    medianFontSize,
  };
}

/**
 * Parses a PDF buffer into coordinate-aware reading-order Markdown pages and text.
 */
export async function extractPdfLayoutDocument(buffer: Buffer): Promise<ExtractedPdfDocument> {
  const rawPages = await extractRawPdfPages(buffer);
  return reconstructPagesLayout(rawPages);
}
