import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isLiveAIConfigured, resolveRuntimeAIConfig, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import { formatTimestampSec } from '@/lib/demo-workspace';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import {
  CrossLink,
  ExpandNodeRequestSchema,
  MindMapNode,
  SourceAnchor,
  SourceSegment,
} from '@/lib/schemas';

const RawExpandSchema = z.object({
  children: z
    .array(
      z.object({
        topic: z.string().min(1).max(160),
        summary: z.string().max(1000),
        segmentId: z.string().optional(),
      })
    )
    .min(1)
    .max(6),
});

function pickAnchorForText(
  text: string,
  segments?: SourceSegment[]
): SourceAnchor[] {
  if (!segments || segments.length === 0) return [];
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  let best: SourceSegment | null = null;
  let bestScore = 0;

  for (const seg of segments) {
    const lower = seg.text.toLowerCase();
    const score = words.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  }
  const chosen = best || segments[0];
  return [
    {
      sourceId: chosen.sourceId,
      segmentId: chosen.id,
      sourceType: chosen.startSec !== undefined ? 'youtube' : chosen.pageNumber ? 'pdf' : 'text',
      label:
        chosen.startSec !== undefined
          ? `▶ ${formatTimestampSec(chosen.startSec)}`
          : chosen.pageNumber
            ? `Page ${chosen.pageNumber}`
            : chosen.heading || 'Source Segment',
      excerpt: chosen.text.slice(0, 240),
      pageNumber: chosen.pageNumber,
      timestampSec: chosen.startSec,
    },
  ];
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'expand'), 30, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Rate limit exceeded for node expansion.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = ExpandNodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid expand node payload.', requestId, 400);
  }

  const { workspaceTitle, node, siblingTopics, ancestorTopics, sourceSegments } = parsed.data;
  const config = resolveRuntimeAIConfig(request.headers);

  try {
    if (!isLiveAIConfigured(config)) {
      const templates = [
        {
          topic: `${node.topic}: Core Mechanism`,
          summary: `Breaks down the internal mechanics and constraints behind ${node.topic}.`,
        },
        {
          topic: `${node.topic}: Practical Application`,
          summary: `How ${node.topic} is applied in real systems within ${workspaceTitle}.`,
        },
        {
          topic: `${node.topic}: Tradeoffs & Failure Modes`,
          summary: `Key edge cases, bottlenecks, or assumptions limiting ${node.topic}.`,
        },
      ].filter((t) => !siblingTopics.some((s) => s.toLowerCase() === t.topic.toLowerCase()));

      const children: MindMapNode[] = templates.map((item, idx) => ({
        id: `${node.id}_exp_${crypto.randomUUID().slice(0, 5)}_${idx}`,
        parentId: node.id,
        topic: item.topic.slice(0, 140),
        summary: item.summary,
        level: 2,
        children: [],
        anchors: pickAnchorForText(item.topic, sourceSegments),
        lenses: [],
        mastery: 'untested',
      }));

      return apiSuccess(
        { children, newCrossLinks: [] as CrossLink[], usedFallback: true },
        requestId
      );
    }

    const segmentCtx = (sourceSegments || [])
      .slice(0, 10)
      .map((s) => `[${s.id}] ${s.text.slice(0, 300)}`)
      .join('\n');

    const raw = await runAICompletion({
      config,
      systemPrompt: `You expand a knowledge map node with 3 to 4 sharper, non-overlapping sub-topics.
Return ONLY valid JSON:
{
  "children": [
    { "topic": "2-6 word sub-topic", "summary": "1-2 concise sentences", "segmentId": "optional matching segment id" }
  ]
}`,
      userPrompt: `Workspace: "${workspaceTitle}"
Target Node: "${node.topic}" (${node.summary})
Ancestors: ${ancestorTopics.join(' > ') || 'None'}
Existing Siblings (do not duplicate): ${siblingTopics.join(', ') || 'None'}
${segmentCtx ? `\nRelevant Source Segments:\n${segmentCtx}` : ''}`,
      temperature: 0.45,
    });

    const validated = extractAndValidateJson(raw, RawExpandSchema);
    if (!validated.ok) {
      return apiError('AI_SCHEMA_INVALID', validated.error, requestId, 502);
    }

    const segLookup = new Map((sourceSegments || []).map((s) => [s.id, s]));
    const children: MindMapNode[] = validated.data.children.map((c, idx) => {
      const matched = c.segmentId ? segLookup.get(c.segmentId) : undefined;
      return {
        id: `${node.id}_exp_${crypto.randomUUID().slice(0, 5)}_${idx}`,
        parentId: node.id,
        topic: c.topic,
        summary: c.summary,
        level: 2,
        children: [],
        anchors: matched
          ? pickAnchorForText(c.topic, [matched])
          : pickAnchorForText(c.topic, sourceSegments),
        lenses: [],
        mastery: 'untested',
      };
    });

    logger.info('expand.completed', { requestId, nodeId: node.id, count: children.length });
    return apiSuccess({ children, newCrossLinks: [] as CrossLink[], usedFallback: false }, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Node expansion failed';
    logger.error('expand.failed', { requestId, errorMessage: message });
    return apiError('AI_UPSTREAM_ERROR', message, requestId, 502);
  }
}
