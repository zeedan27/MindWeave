import type { SourceSegment } from '@/lib/schemas';

const REFERENCE_HEADING_REGEX =
  /^(?:\d+(?:\.\d+)*\.?\s+)?(?:references|bibliography|works\s+cited)$/i;

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'are',
  'was',
  'were',
  'been',
  'have',
  'has',
  'had',
  'not',
  'but',
  'can',
  'will',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'into',
  'about',
  'than',
  'then',
  'them',
  'they',
  'their',
  'there',
  'these',
  'those',
  'does',
  'did',
  'its',
  'our',
  'your',
  'you',
]);

/**
 * Identifies reference/bibliography segments so they can be de-prioritized
 * behind substantive body sections during synthesis and retrieval.
 */
export function isReferenceSegment(seg: SourceSegment): boolean {
  if (seg.heading && REFERENCE_HEADING_REGEX.test(seg.heading.trim())) {
    return true;
  }

  const trimmed = seg.text.trim();
  if (/^references\b[:\s]/i.test(trimmed)) {
    return true;
  }

  const bracketCitations = trimmed.match(/\[\d+\]/g)?.length ?? 0;
  const yearMatches = trimmed.match(/\b(?:19|20)\d{2}\b/g)?.length ?? 0;
  if (bracketCitations >= 2 && yearMatches >= 2) {
    return true;
  }

  const etAlMatches = trimmed.match(/\bet\s+al\./gi)?.length ?? 0;
  return etAlMatches >= 2 && yearMatches >= 2;
}

function isTableSegment(seg: SourceSegment): boolean {
  return seg.text.includes('\n| ---');
}

function pickEvenlySpacedIndices(indices: number[], count: number): number[] {
  if (indices.length <= count) return indices;
  if (count <= 0) return [];
  if (count === 1) return [indices[Math.floor(indices.length / 2)]];

  const picked: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const pos = Math.round((i * (indices.length - 1)) / (count - 1));
    picked.push(indices[pos]);
  }
  return picked;
}

/**
 * Selects a whole-document stratified sample across opening, distinct middle headings/tables,
 * and closing sections while excluding References unless no other content exists.
 */
export function sampleStratifiedSegments(
  segments: SourceSegment[],
  maxCount: number
): SourceSegment[] {
  if (maxCount <= 0 || segments.length === 0) return [];

  const core = segments.filter((s) => !isReferenceSegment(s));
  const pool = core.length > 0 ? core : segments;

  if (pool.length <= maxCount) {
    return pool;
  }

  const selected = new Set<number>();
  const openCount = Math.min(4, Math.max(1, Math.floor(maxCount * 0.25)));
  const closeCount = Math.min(3, Math.max(1, Math.floor(maxCount * 0.15)));

  for (let i = 0; i < openCount && i < pool.length; i += 1) {
    selected.add(i);
  }
  for (let i = Math.max(openCount, pool.length - closeCount); i < pool.length; i += 1) {
    selected.add(i);
  }

  const midStart = openCount;
  const midEnd = pool.length - closeCount;
  const midBudget = Math.max(0, maxCount - selected.size);

  if (midBudget > 0 && midEnd > midStart) {
    const seenHeadings = new Set<string>();
    for (const idx of selected) {
      const h = pool[idx].heading?.trim().toLowerCase();
      if (h) seenHeadings.add(h);
    }

    const priorityIndices: number[] = [];

    for (let i = midStart; i < midEnd; i += 1) {
      const seg = pool[i];
      const headingKey = seg.heading?.trim().toLowerCase();
      const isNewSection = Boolean(headingKey && !seenHeadings.has(headingKey));
      if (isNewSection && headingKey) {
        seenHeadings.add(headingKey);
      }

      if (isNewSection || isTableSegment(seg)) {
        priorityIndices.push(i);
      }
    }

    for (const idx of pickEvenlySpacedIndices(priorityIndices, midBudget)) {
      selected.add(idx);
    }

    const leftoverBudget = maxCount - selected.size;
    if (leftoverBudget > 0) {
      const unpicked = [];
      for (let i = midStart; i < midEnd; i += 1) {
        if (!selected.has(i)) unpicked.push(i);
      }
      for (const idx of pickEvenlySpacedIndices(unpicked, leftoverBudget)) {
        selected.add(idx);
      }
    }
  }

  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((idx) => pool[idx]);
}

/**
 * Ranks segments by query term overlap across headings and text (preferring tables for
 * quantitative queries and de-prioritizing References), falling back to stratified sampling.
 */
export function rankRelevantSegments(
  query: string,
  segments: SourceSegment[],
  limit: number
): SourceSegment[] {
  if (limit <= 0 || segments.length === 0) return [];
  if (segments.length <= limit) return segments;

  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const tokens = Array.from(
    new Set(
      normalizedQuery
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    )
  );

  const wantsTabularData =
    /\b(?:table|result|results|benchmark|metric|metrics|score|scores|accuracy|comparison|data)\b/i.test(
      normalizedQuery
    );

  const scored = segments.map((seg, position) => {
    const headingLower = (seg.heading || '').toLowerCase();
    const textLower = seg.text.toLowerCase();
    let score = 0;

    for (const token of tokens) {
      if (headingLower.includes(token)) score += 3;
      if (textLower.includes(token)) score += 1;
    }

    if (normalizedQuery.length >= 6) {
      if (headingLower.includes(normalizedQuery) || textLower.includes(normalizedQuery)) {
        score += 4;
      }
    }

    if (wantsTabularData && isTableSegment(seg)) {
      score += 2;
    }

    if (isReferenceSegment(seg)) {
      score -= 5;
    }

    return { seg, score, position };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));
  if (maxScore <= 0) {
    return sampleStratifiedSegments(segments, limit);
  }

  return scored
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map((item) => item.seg);
}
