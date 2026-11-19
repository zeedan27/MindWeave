import crypto from 'node:crypto';
import { z } from 'zod';
import { isLiveAIConfigured, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import {
  buildDeterministicWorkspaceFromSources,
  formatTimestampSec,
} from '@/lib/demo-workspace';
import type {
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
  summary?: string;
  segmentIds?: string[];
  agreement?: z.infer<typeof AgreementStatusSchema>;
  children?: RawGeneratedNode[];
}

const RawGeneratedNodeSchema: z.ZodType<RawGeneratedNode> = z.lazy(() =>
  z.object({
    topic: z.string().min(1).max(160),
    summary: z.string().max(1000).optional(),
    segmentIds: z.array(z.string()).optional(),
    agreement: AgreementStatusSchema.optional(),
    children: z.array(RawGeneratedNodeSchema).optional(),
  })
);

const RawWeaveOutputSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().max(300).optional(),
  rootNode: RawGeneratedNodeSchema,
  crossLinks: z
    .array(
      z.object({
        sourceTopic: z.string().min(1),
        targetTopic: z.string().min(1),
        relation: CrossLinkRelationSchema,
        label: z.string().min(1).max(60),
        rationale: z.string().min(1).max(600),
      })
    )
    .default([]),
  blindSpots: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        missingPerspective: z.string().min(1).max(800),
        whyItMatters: z.string().min(1).max(800),
        suggestedParentTopic: z.string().min(1).max(140),
        suggestedTopic: z.string().min(1).max(140),
        suggestedSummary: z.string().min(1).max(600),
      })
    )
    .default([]),
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
  const serializedSources = sources
    .map((src) => {
      const segLines = src.segments
        .slice(0, 16)
        .map((s) => {
          const loc =
            s.startSec !== undefined
              ? `t=${formatTimestampSec(s.startSec)}`
              : s.pageNumber
                ? `p.${s.pageNumber}`
                : s.heading || 'note';
          return `[${s.id} | ${loc}] ${s.text.slice(0, 420)}`;
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
- Create 4-6 level-1 branches, each with 2-3 level-2 sub-nodes.
- Ground nodes in actual segmentIds from the prompt whenever applicable.
- Provide 2-3 meaningful crossLinks across different branches and 2 blindSpots.`;

  const rawText = await runAICompletion({
    config,
    systemPrompt,
    userPrompt: `Synthesize these ${sources.length} source(s):\n\n${serializedSources}`,
    temperature: 0.35,
    maxTokens: 4096,
  });

  const validated = extractAndValidateJson(rawText, RawWeaveOutputSchema);
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
    topicToId.set(raw.topic.toLowerCase().trim(), id);

    const anchors: SourceAnchor[] = [];
    for (const segId of raw.segmentIds || []) {
      const hit = segmentLookup.get(segId);
      if (hit) {
        anchors.push(segmentToAnchor(hit.source, hit.segment, isMultiSource ? raw.agreement : undefined));
      }
    }

    if (level <= 1) {
      walkthrough.push({
        stepIndex: walkthrough.length,
        nodeId: id,
        headline: raw.topic,
        narrative: raw.summary || `Explore ${raw.topic}.`,
        durationSec: 6,
      });
    }

    const children = (raw.children || []).map((child, idx) =>
      hydrateNode(child, level === 0 ? `n_${idx}` : `${id}_${idx}`, id, level + 1)
    );

    return {
      id,
      parentId,
      topic: raw.topic,
      summary: raw.summary || '',
      level,
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
        label: xl.label,
        rationale: xl.rationale,
        isAiSuggested: true,
      });
    }
  }

  const blindSpots: BlindSpotInsight[] = parsed.blindSpots.map((bs) => ({
    id: `bs_${crypto.randomUUID().slice(0, 8)}`,
    title: bs.title,
    missingPerspective: bs.missingPerspective,
    whyItMatters: bs.whyItMatters,
    suggestedParentNodeId:
      topicToId.get(bs.suggestedParentTopic.toLowerCase().trim()) || 'root',
    suggestedTopic: bs.suggestedTopic,
    suggestedSummary: bs.suggestedSummary,
    resolved: false,
  }));

  const now = Date.now();
  return {
    usedFallback: false,
    workspace: {
      id: `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      schemaVersion: 1,
      title: parsed.title,
      subtitle:
        parsed.subtitle ||
        `${sources.length} woven source${sources.length > 1 ? 's' : ''}`,
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
