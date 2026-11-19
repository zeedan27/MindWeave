import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isLiveAIConfigured, resolveRuntimeAIConfig, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import {
  BlindSpotInsight,
  BlindSpotsRequestSchema,
  CrossLink,
  CrossLinkRelationSchema,
} from '@/lib/schemas';

const RawBlindSpotsSchema = z.object({
  blindSpots: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        missingPerspective: z.string().min(1).max(1000),
        whyItMatters: z.string().min(1).max(1000),
        suggestedParentNodeId: z.string().min(1),
        suggestedTopic: z.string().min(1).max(160),
        suggestedSummary: z.string().min(1).max(800),
      })
    )
    .min(1)
    .max(5),
  suggestedCrossLinks: z
    .array(
      z.object({
        sourceNodeId: z.string().min(1),
        targetNodeId: z.string().min(1),
        relation: CrossLinkRelationSchema,
        label: z.string().min(1).max(60),
        rationale: z.string().min(1).max(800),
      })
    )
    .max(5)
    .default([]),
});

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'blindspots'), 20, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Rate limit exceeded for blind spot scan.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = BlindSpotsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid blind spots payload.', requestId, 400);
  }

  const { workspaceTitle, nodesOutline, existingCrossLinks, sourceSummary } = parsed.data;
  const validNodeIds = new Set(nodesOutline.map((n) => n.id));
  const config = resolveRuntimeAIConfig(request.headers);

  try {
    if (!isLiveAIConfigured(config)) {
      const topBranches = nodesOutline.filter((n) => n.parentId === 'root');
      const suggestedCrossLinks: CrossLink[] =
        topBranches.length >= 2 && existingCrossLinks.length === 0
          ? [
              {
                id: `xl_bs_${crypto.randomUUID().slice(0, 6)}`,
                sourceNodeId: topBranches[0].id,
                targetNodeId: topBranches[topBranches.length - 1].id,
                relation: 'bridges',
                label: 'structural bridge',
                rationale: `Connects ${topBranches[0].topic} with ${topBranches[topBranches.length - 1].topic} across separated branches.`,
                isAiSuggested: true,
              },
            ]
          : [];

      const blindSpots: BlindSpotInsight[] = [
        {
          id: `bs_${crypto.randomUUID().slice(0, 8)}`,
          title: 'Empirical Benchmarks & Failure Boundaries',
          missingPerspective: `The current outline of "${workspaceTitle}" describes concepts positively but lacks explicit falsification criteria or benchmark limits.`,
          whyItMatters:
            'Understanding where a framework fails sharpens mental models and prevents over-generalization.',
          suggestedParentNodeId: topBranches[0]?.id || 'root',
          suggestedTopic: 'Failure Modes & Benchmarks',
          suggestedSummary:
            'Quantifies empirical limits, edge cases, and falsification tests for core claims.',
          resolved: false,
        },
        {
          id: `bs_${crypto.randomUUID().slice(0, 8)}`,
          title: 'Alternative Paradigms Comparison',
          missingPerspective:
            'No branch directly contrasts this topic against competing architectures or historical predecessors.',
          whyItMatters: 'Comparative framing reveals why design choices exist in the first place.',
          suggestedParentNodeId: 'root',
          suggestedTopic: 'Competing Approaches',
          suggestedSummary:
            'Side-by-side tradeoffs against predecessor and modern alternative methods.',
          resolved: false,
        },
      ];

      return apiSuccess({ blindSpots, suggestedCrossLinks, usedFallback: true }, requestId);
    }

    const outlineStr = nodesOutline
      .slice(0, 80)
      .map((n) => `- [${n.id}] (parent=${n.parentId || 'null'}) ${n.topic}: ${n.summary}`)
      .join('\n');

    const raw = await runAICompletion({
      config,
      systemPrompt: `You are an InfraNodus-style graph-topology analyst. Inspect the mind map structure and surface structural blind spots (unstated assumptions, missing counter-perspectives, isolated clusters) and meaningful cross-branch semantic links.
Return ONLY valid JSON:
{
  "blindSpots": [
    {
      "title": "...",
      "missingPerspective": "...",
      "whyItMatters": "...",
      "suggestedParentNodeId": "existing node id from list",
      "suggestedTopic": "2-6 words",
      "suggestedSummary": "1-2 sentences"
    }
  ],
  "suggestedCrossLinks": [
    {
      "sourceNodeId": "existing id",
      "targetNodeId": "distinct existing id",
      "relation": "causes" | "contradicts" | "depends_on" | "supports" | "bridges",
      "label": "2-3 word label",
      "rationale": "1 sentence"
    }
  ]
}`,
      userPrompt: `Workspace: "${workspaceTitle}"
Nodes:\n${outlineStr}
Existing cross-links: ${existingCrossLinks.map((x) => `${x.sourceNodeId}->${x.targetNodeId}`).join(', ') || 'None'}
${sourceSummary ? `\nSources Context:\n${sourceSummary.slice(0, 3000)}` : ''}`,
      temperature: 0.4,
    });

    const validated = extractAndValidateJson(raw, RawBlindSpotsSchema);
    if (!validated.ok) {
      return apiError('AI_SCHEMA_INVALID', validated.error, requestId, 502);
    }

    const blindSpots: BlindSpotInsight[] = validated.data.blindSpots.map((b) => ({
      id: `bs_${crypto.randomUUID().slice(0, 8)}`,
      ...b,
      suggestedParentNodeId: validNodeIds.has(b.suggestedParentNodeId)
        ? b.suggestedParentNodeId
        : 'root',
      resolved: false,
    }));

    const suggestedCrossLinks: CrossLink[] = validated.data.suggestedCrossLinks
      .filter(
        (xl) =>
          validNodeIds.has(xl.sourceNodeId) &&
          validNodeIds.has(xl.targetNodeId) &&
          xl.sourceNodeId !== xl.targetNodeId
      )
      .map((xl) => ({
        id: `xl_${crypto.randomUUID().slice(0, 8)}`,
        ...xl,
        isAiSuggested: true,
      }));

    logger.info('blindspots.completed', { requestId, count: blindSpots.length });
    return apiSuccess({ blindSpots, suggestedCrossLinks, usedFallback: false }, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Blind spot detection failed';
    logger.error('blindspots.failed', { requestId, errorMessage: message });
    return apiError('AI_UPSTREAM_ERROR', message, requestId, 502);
  }
}
