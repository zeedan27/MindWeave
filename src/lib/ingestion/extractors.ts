import crypto from 'node:crypto';
import type { SourceDocument, SourceSegment } from '@/lib/schemas';
import { extractPdfLayoutDocument } from '@/lib/ingestion/pdf-layout';

const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/,
];

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
      return match[1];
    }
  }
  return null;
}

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)));
}

const TABLE_LINE_REGEX = /^\|.+\|$/;
const TABLE_SEPARATOR_REGEX = /^\|(?:\s*:?-{2,}:?\s*\|)+$/;

export function chunkTextIntoSegments(
  sourceId: string,
  rawText: string,
  pageNumber?: number,
  startIndex = 0,
  initialHeading?: string
): SourceSegment[] {
  const lines = rawText.split(/\r?\n/);
  const segments: SourceSegment[] = [];
  let currentHeading: string | undefined = initialHeading;
  let buffer: string[] = [];
  let tableLines: string[] = [];

  const pushSegment = (text: string) => {
    segments.push({
      id: `${sourceId}-seg-${startIndex + segments.length}`,
      sourceId,
      index: startIndex + segments.length,
      text: text.slice(0, 1500),
      pageNumber,
      heading: currentHeading,
    });
  };

  const flush = () => {
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];
    if (text.length < 15) return;
    pushSegment(text);
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const rows = tableLines;
    tableLines = [];

    const joined = rows.join('\n').trim();
    if (!joined) return;
    if (joined.length <= 1500) {
      pushSegment(joined);
      return;
    }

    const hasHeader = rows.length >= 2 && TABLE_SEPARATOR_REGEX.test(rows[1].trim());
    const headerBlock = hasHeader ? `${rows[0]}\n${rows[1]}` : '';
    const dataRows = hasHeader ? rows.slice(2) : rows;
    let chunkRows: string[] = headerBlock ? [headerBlock] : [];

    for (const row of dataRows) {
      const candidate = [...chunkRows, row].join('\n');
      if (candidate.length > 1500 && chunkRows.length > (headerBlock ? 1 : 0)) {
        pushSegment(chunkRows.join('\n'));
        chunkRows = headerBlock ? [headerBlock, row] : [row];
      } else {
        chunkRows.push(row);
      }
    }

    if (chunkRows.length > (headerBlock ? 1 : 0) || (!headerBlock && chunkRows.length > 0)) {
      pushSegment(chunkRows.join('\n'));
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (TABLE_LINE_REGEX.test(trimmed)) {
      flush();
      tableLines.push(trimmed);
      continue;
    }

    if (tableLines.length > 0) {
      flushTable();
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].trim().slice(0, 140);
      continue;
    }
    if (trimmed.length === 0) {
      flush();
      continue;
    }
    buffer.push(trimmed);
    if (buffer.join(' ').length > 800) {
      flush();
    }
  }

  flushTable();
  flush();

  if (segments.length === 0 && rawText.trim().length > 0) {
    pushSegment(rawText.trim());
  }

  return segments;
}

export async function extractFromPdfBuffer(
  buffer: Buffer,
  fileName: string
): Promise<SourceDocument> {
  const extracted = await extractPdfLayoutDocument(buffer);
  const minChars = extracted.pages.length >= 2 ? 50 : 10;

  if (
    extracted.pages.length === 0 ||
    extracted.totalMeaningfulChars < minChars ||
    !extracted.fullText.trim()
  ) {
    throw new Error(
      'Could not extract meaningful text from PDF (the file appears to be scanned images or empty).'
    );
  }

  const sourceId = `src_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const segments: SourceSegment[] = [];
  let activeHeading: string | undefined;

  for (const page of extracted.pages) {
    if (!page.text.trim()) continue;
    const pageSegments = chunkTextIntoSegments(
      sourceId,
      page.text,
      page.pageNumber,
      segments.length,
      activeHeading
    );
    segments.push(...pageSegments);

    const lastHeadingInSegs = pageSegments[pageSegments.length - 1]?.heading;
    const headingMatches = Array.from(page.text.matchAll(/^#{1,4}\s+(.+)$/gm));
    const lastHeadingInText =
      headingMatches.length > 0
        ? headingMatches[headingMatches.length - 1][1].trim().slice(0, 140)
        : undefined;
    activeHeading = lastHeadingInText || lastHeadingInSegs || activeHeading;

    if (segments.length >= 200) break;
  }

  if (segments.length === 0) {
    segments.push(...chunkTextIntoSegments(sourceId, extracted.fullText, 1, 0));
  }

  const firstLine = extracted.fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !TABLE_LINE_REGEX.test(l) && !TABLE_SEPARATOR_REGEX.test(l))
    .map((l) => l.replace(/^#{1,4}\s+/, '').trim())
    .find((l) => l.length > 4);
  const title = (firstLine || fileName.replace(/\.[^.]+$/, '') || 'Untitled PDF').slice(0, 140);

  return {
    id: sourceId,
    type: 'pdf',
    title,
    originLabel: fileName.slice(0, 240),
    fileName: fileName.slice(0, 240),
    rawTextHash: sha256Hex(extracted.fullText),
    segments: segments.slice(0, 200),
    createdAt: Date.now(),
  };
}

export function extractFromText(
  rawText: string,
  title: string,
  type: 'topic' | 'text',
  fileName?: string
): SourceDocument {
  const cleaned = rawText.trim();
  if (!cleaned) {
    throw new Error('Text source cannot be empty.');
  }

  const sourceId = `src_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const segments =
    type === 'topic'
      ? [
          {
            id: `${sourceId}-seg-0`,
            sourceId,
            index: 0,
            heading: title || cleaned.slice(0, 80),
            text: cleaned.slice(0, 1200),
          },
        ]
      : chunkTextIntoSegments(sourceId, cleaned);

  return {
    id: sourceId,
    type,
    title: (title || cleaned.slice(0, 80)).slice(0, 160),
    originLabel: fileName || (type === 'topic' ? 'Topic Prompt' : 'Markdown / Notes'),
    fileName,
    rawTextHash: sha256Hex(cleaned),
    segments: segments.slice(0, 60),
    createdAt: Date.now(),
  };
}

function parseTimestampToSeconds(raw: string): number {
  const parts = raw.split(':').map((n) => Number(n));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseChapterLines(sourceId: string, description: string): SourceSegment[] {
  const segments: SourceSegment[] = [];
  const regex = /^(?:[-•]\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\s+[-–—:]?\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(description)) !== null) {
    const startSec = parseTimestampToSeconds(match[1]);
    const heading = match[2].trim().slice(0, 120);
    segments.push({
      id: `${sourceId}-seg-${segments.length}`,
      sourceId,
      index: segments.length,
      startSec,
      heading,
      text: `Chapter at ${match[1]}: ${heading}`,
    });
  }
  return segments;
}

function parseTimedTextXml(sourceId: string, xml: string, startIndex: number): SourceSegment[] {
  const rawCues: Array<{ start: number; dur: number; text: string }> = [];
  const tagRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(xml)) !== null) {
    const text = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    rawCues.push({
      start: Number(m[1]),
      dur: Number(m[2] || '4'),
      text,
    });
  }

  // Group cues into ~35-second digestible study segments
  const segments: SourceSegment[] = [];
  let bucketText: string[] = [];
  let bucketStart = 0;
  let bucketEnd = 0;

  for (const cue of rawCues) {
    if (bucketText.length === 0) {
      bucketStart = cue.start;
    }
    bucketText.push(cue.text);
    bucketEnd = cue.start + cue.dur;

    if (bucketEnd - bucketStart >= 35 || bucketText.join(' ').length > 420) {
      segments.push({
        id: `${sourceId}-seg-${startIndex + segments.length}`,
        sourceId,
        index: startIndex + segments.length,
        startSec: Math.floor(bucketStart),
        endSec: Math.ceil(bucketEnd),
        text: bucketText.join(' ').slice(0, 900),
      });
      bucketText = [];
    }
  }
  if (bucketText.length > 0) {
    segments.push({
      id: `${sourceId}-seg-${startIndex + segments.length}`,
      sourceId,
      index: startIndex + segments.length,
      startSec: Math.floor(bucketStart),
      endSec: Math.ceil(bucketEnd),
      text: bucketText.join(' ').slice(0, 900),
    });
  }

  return segments;
}

export async function extractFromYouTube(urlOrId: string): Promise<SourceDocument> {
  const videoId = extractYouTubeId(urlOrId);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or video ID.');
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const sourceId = `src_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

  let title = `YouTube Video (${videoId})`;
  let channel = 'YouTube';
  let description = '';
  let segments: SourceSegment[] = [];

  try {
    const res = await fetch(canonicalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MindWeaveBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (res.ok) {
      const html = await res.text();
      const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/);
      if (playerMatch) {
        try {
          const playerData = JSON.parse(playerMatch[1]) as {
            videoDetails?: {
              title?: string;
              author?: string;
              shortDescription?: string;
            };
            captions?: {
              playerCaptionsTracklistRenderer?: {
                captionTracks?: Array<{ baseUrl?: string; languageCode?: string }>;
              };
            };
          };

          if (playerData.videoDetails?.title) title = playerData.videoDetails.title;
          if (playerData.videoDetails?.author) channel = playerData.videoDetails.author;
          if (playerData.videoDetails?.shortDescription) {
            description = playerData.videoDetails.shortDescription;
          }

          const tracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          const englishTrack =
            tracks.find((t) => t.languageCode?.startsWith('en')) || tracks[0];

          if (englishTrack?.baseUrl && englishTrack.baseUrl.startsWith('https://')) {
            const capRes = await fetch(englishTrack.baseUrl, {
              signal: AbortSignal.timeout(5000),
            });
            if (capRes.ok) {
              const xml = await capRes.text();
              segments = parseTimedTextXml(sourceId, xml, 0);
            }
          }
        } catch {
          // Fall back to metadata/chapter parsing below
        }
      }

      if (title === `YouTube Video (${videoId})`) {
        const titleTag = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (titleTag) {
          title = decodeHtmlEntities(titleTag[1].replace(/\s*-\s*YouTube\s*$/i, '').trim());
        }
      }
    }
  } catch {
    // Graceful network fallback: still create a valid YouTube source card
  }

  if (segments.length === 0 && description) {
    segments = parseChapterLines(sourceId, description);
  }

  if (segments.length === 0) {
    const fallbackBody = description
      ? description.slice(0, 1000)
      : `YouTube video source (${canonicalUrl}). Transcript captions were unavailable; concepts mapped from video metadata and topic context.`;
    segments = [
      {
        id: `${sourceId}-seg-0`,
        sourceId,
        index: 0,
        startSec: 0,
        heading: title,
        text: fallbackBody,
      },
    ];
  }

  return {
    id: sourceId,
    type: 'youtube',
    title: title.slice(0, 180),
    originLabel: `${channel} · YouTube`,
    url: canonicalUrl,
    rawTextHash: sha256Hex(`${videoId}:${title}:${segments.map((s) => s.text).join('|')}`),
    segments: segments.slice(0, 60),
    createdAt: Date.now(),
  };
}
