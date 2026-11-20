import crypto from 'node:crypto';
import { z } from 'zod';
import { isLiveAIConfigured, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import {
  buildDeterministicWorkspaceFromSources,
  formatTimestampSec,
} from '@/lib/demo-workspace';
import { sampleStratifiedSegments } from '@/lib/ingestion/segment-ranker';
import { logger } from '@/lib/logger';
import type {
  AgreementStatus,
  BlindSpotInsight,
  CrossLink,
  MindMapNode,
  MindMapWorkspace,
  RuntimeAIConfig,
  SourceAnchor,
  SourceDocument,
  SourceSegment,
  WalkthroughStep,
} from '@/lib/schemas';
import {
  AgreementStatusSchema,
  CrossLinkRelationSchema,
} from '@/lib/schemas';

interface RawGeneratedNode {
  topic: string;
  summary: string;
  segmentIds: string[];
  agreement?: AgreementStatus;
  children: RawGeneratedNode[];
}

const RawGeneratedNodeSchema: z.ZodType<RawGeneratedNode> = z.lazy(() =>
  z.object({
    topic: z.string().min(1),
    summary: z
      .string()
      .nullish()
      .transform((v) => v ?? ''),
    segmentIds: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
    agreement: z
      .string()
      .nullish()
      .transform((v): AgreementStatus | undefined =>
        v === 'consensus' || v === 'unique' || v === 'contradiction' ? v : undefined
      ),
    children: z
      .array(RawGeneratedNodeSchema)
      .nullish()
      .transform((v) => v ?? []),
  })
);

const RawWeaveOutputSchema = z.object({
  title: z.string().min(1),
  subtitle: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  rootNode: RawGeneratedNodeSchema,
  crossLinks: z
    .array(
      z.object({
        sourceTopic: z.string().min(1),
        targetTopic: z.string().min(1),
        relation: z
          .string()
          .nullish()
          .transform((v): z.infer<typeof CrossLinkRelationSchema> =>
            CrossLinkRelationSchema.safeParse(v).success
              ? (v as z.infer<typeof CrossLinkRelationSchema>)
              : 'bridges'
          ),
        label: z.string().min(1),
        rationale: z
          .string()
          .nullish()
          .transform((v) => v || 'Semantic connection across branches.'),
      })
    )
    .nullish()
    .transform((v) => v ?? []),
  blindSpots: z
    .array(
      z.object({
        title: z.string().min(1),
        missingPerspective: z.string().min(1),
        whyItMatters: z.string().min(1),
        suggestedParentTopic: z
          .string()
          .nullish()
          .transform((v) => v || 'root'),
        suggestedTopic: z.string().min(1),
        suggestedSummary: z
          .string()
          .nullish()
          .transform((v) => v ?? ''),
      })
    )
    .nullish()
    .transform((v) => v ?? []),
});

function buildSegmentLookup(sources: SourceDocument[]) {
  const segmentMap = new Map<string, { source: SourceDocument; segment: SourceSegment }>();
  for (const src of sources) {
    for (const seg of src.segments) {
      segmentMap.set(seg.id, { source: src, segment: seg });
    }
  }
  return segmentMap;
}

function segmentToAnchor(
  source: SourceDocument,
  segment: SourceSegment,
  agreement?: z.infer<typeof AgreementStatusSchema>
): SourceAnchor {
  const label =
    source.type === 'youtube' && segment.startSec !== undefined
      ? `▶ ${formatTimestampSec(segment.startSec)}`
      : segment.pageNumber
        ? `Page ${segment.pageNumber}`
        : segment.heading || source.originLabel;

  return {
    sourceId: source.id,
    segmentId: segment.id,
    sourceType: source.type,
    label: label.slice(0, 120),
    excerpt: segment.text.slice(0, 320),
    pageNumber: segment.pageNumber,
    timestampSec: segment.startSec,
    agreement,
  };
}

export async function weaveSourcesToWorkspace(
  sources: SourceDocument[],
  config: RuntimeAIConfig
): Promise<{ workspace: MindMapWorkspace; usedFallback: boolean }> {
  if (!isLiveAIConfigured(config)) {
    return {
      workspace: buildDeterministicWorkspaceFromSources(sources),
      usedFallback: true,
    };
  }

  const segmentLookup = buildSegmentLookup(sources);
  const perSourceBudget =
    sources.length === 1 ? 24 : Math.max(8, Math.floor(32 / sources.length));
  const serializedSources = sources
    .map((src) => {
      const sampledSegments = sampleStratifiedSegments(src.segments, perSourceBudget);
      const segLines = sampledSegments
        .map((s) => {
          const loc =
            s.startSec !== undefined
              ? `t=${formatTimestampSec(s.startSec)}`
              : s.pageNumber
                ? `p.${s.pageNumber}`
                : s.heading || 'note';
          const headingTag = s.heading && s.pageNumber ? ` | ${s.heading}` : '';
          return `[${s.id} | ${loc}${headingTag}] ${s.text.slice(0, 750)}`;
        })
        .join('\n');
      return `SOURCE (${src.type}): ${src.title}\n${segLines}`;
    })
    .join('\n\n---\n\n');

  const isMultiSource = sources.length > 1;
  const systemPrompt = `You are MindWeave, an architectural knowledge synthesizer.
Weave the provided sources into one cohesive, non-hallucinated visual mind map.
Return ONLY valid JSON matching this schema:
{
  "title": "Workspace Title",
  "subtitle": "Concise 1-line scope summary",
  "rootNode": {
    "topic": "Central Concept",
    "summary": "1-2 sentence synthesis",
    "segmentIds": ["src_...-seg-0"],
    "children": [
      {
        "topic": "Branch Topic (2-6 words)",
        "summary": "1-2 sentence grounded explanation",
        "segmentIds": ["..."],
        ${isMultiSource ? `"agreement": "consensus" | "unique" | "contradiction",` : ''}
        "children": [...]
      }
    ]
  },
  "crossLinks": [
    {
      "sourceTopic": "Exact topic string of source node",
      "targetTopic": "Exact topic string of target node",
      "relation": "causes" | "contradicts" | "depends_on" | "supports" | "bridges",
      "label": "2-3 word label",
      "rationale": "Why these distinct branches connect"
    }
  ],
  "blindSpots": [
    {
      "title": "Missing perspective or unstated assumption",
      "missingPerspective": "What is missing from the sources",
      "whyItMatters": "Why a learner needs this context",
      "suggestedParentTopic": "Exact topic string of an existing node",
      "suggestedTopic": "New node title",
      "suggestedSummary": "1-2 sentence summary"
    }
  ]
}
Rules:
- Return ONLY strictly valid raw JSON: NO markdown code fences (\`\`\`), NO commentary, NO trailing commas, and NO unescaped newlines inside JSON strings (escape quotes and newlines properly).
- Keep summaries to 1 concise sentence (<= 180 chars) so the complete JSON never truncates.
- Create 4-5 level-1 branches, each with 2-3 level-2 sub-nodes.
- Ground nodes in actual segmentIds from the prompt whenever applicable.
- Provide 2 meaningful crossLinks across different branches and 2 blindSpots.`;

  const rawText = await runAICompletion({
    config,
    systemPrompt,
    userPrompt: `Synthesize these ${sources.length} source(s):\n\n${serializedSources}`,
    temperature: 0.3,
    maxTokens: 8192,
    jsonMode: true,
  });

  let validated = extractAndValidateJson(rawText, RawWeaveOutputSchema);
  if (!validated.ok) {
    logger.warn('weave.json_retry', {
      provider: config.provider,
      error: validated.error,
    });
    const retryText = await runAICompletion({
      config,
      systemPrompt,
      userPrompt: `Your previous response failed JSON validation (${validated.error}). Return a shorter, COMPLETE, strictly valid JSON object (3-4 level-1 branches, 2 sub-nodes each, 1 short sentence per summary, no markdown fences, properly escaped strings) matching the schema for these sources:\n\n${serializedSources}`,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });
    validated = extractAndValidateJson(retryText, RawWeaveOutputSchema);
  }

  if (!validated.ok) {
    throw new Error(`AI_SCHEMA_INVALID:${validated.error}`);
  }

  const parsed = validated.data;
  const topicToId = new Map<string, string>();
  const walkthrough: WalkthroughStep[] = [];

  function hydrateNode(
    raw: RawGeneratedNode,
    id: string,
    parentId: string | null,
    level: number
  ): MindMapNode {
    const topic = raw.topic.trim().slice(0, 180) || 'Concept';
    const summary = (raw.summary || '').trim().slice(0, 1500);
    const boundedLevel = Math.min(level, 16);

    topicToId.set(raw.topic.toLowerCase().trim(), id);
    topicToId.set(topic.toLowerCase(), id);

    const anchors: SourceAnchor[] = [];
    for (const segId of raw.segmentIds || []) {
      const hit = segmentLookup.get(segId);
      if (hit) {
        anchors.push(segmentToAnchor(hit.source, hit.segment, isMultiSource ? raw.agreement : undefined));
      }
    }

    if (boundedLevel <= 1) {
      walkthrough.push({
        stepIndex: walkthrough.length,
        nodeId: id,
        headline: topic.slice(0, 180),
        narrative: (summary || `Explore ${topic}.`).slice(0, 1200),
        durationSec: 6,
      });
    }

    const children = (raw.children || []).map((child, idx) =>
      hydrateNode(child, boundedLevel === 0 ? `n_${idx}` : `${id}_${idx}`, id, boundedLevel + 1)
    );

    return {
      id,
      parentId,
      topic,
      summary,
      level: boundedLevel,
      children,
      anchors,
      lenses: [],
      mastery: 'untested',
    };
  }

  const rootNode = hydrateNode(parsed.rootNode, 'root', null, 0);

  const crossLinks: CrossLink[] = [];
  for (const xl of parsed.crossLinks) {
    const sId = topicToId.get(xl.sourceTopic.toLowerCase().trim());
    const tId = topicToId.get(xl.targetTopic.toLowerCase().trim());
    if (sId && tId && sId !== tId) {
      crossLinks.push({
        id: `xl_${crypto.randomUUID().slice(0, 8)}`,
        sourceNodeId: sId,
        targetNodeId: tId,
        relation: xl.relation,
        label: xl.label.slice(0, 60),
        rationale: xl.rationale.slice(0, 800),
        isAiSuggested: true,
      });
    }
  }

  const blindSpots: BlindSpotInsight[] = parsed.blindSpots.map((bs) => ({
    id: `bs_${crypto.randomUUID().slice(0, 8)}`,
    title: bs.title.slice(0, 160),
    missingPerspective: bs.missingPerspective.slice(0, 1000),
    whyItMatters: bs.whyItMatters.slice(0, 1000),
    suggestedParentNodeId:
      topicToId.get(bs.suggestedParentTopic.toLowerCase().trim()) || 'root',
    suggestedTopic: bs.suggestedTopic.slice(0, 160),
    suggestedSummary: bs.suggestedSummary.slice(0, 800),
    resolved: false,
  }));

  const now = Date.now();
  return {
    usedFallback: false,
    workspace: {
      id: `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      schemaVersion: 1,
      title: parsed.title.trim().slice(0, 200),
      subtitle: (
        parsed.subtitle ||
        `${sources.length} woven source${sources.length > 1 ? 's' : ''}`
      ).slice(0, 500),
      layoutMode: 'balanced',
      sources,
      rootNode,
      crossLinks,
      blindSpots,
      walkthrough,
      chatMessages: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}
