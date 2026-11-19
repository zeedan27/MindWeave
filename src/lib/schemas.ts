import { z } from 'zod';

export const SourceTypeSchema = z.enum(['topic', 'pdf', 'text', 'youtube']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSegmentSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  index: z.number().int().min(0),
  text: z.string().min(1),
  pageNumber: z.number().int().min(1).optional(),
  startSec: z.number().min(0).optional(),
  endSec: z.number().min(0).optional(),
  heading: z.string().max(240).optional(),
});
export type SourceSegment = z.infer<typeof SourceSegmentSchema>;

export const SourceDocumentSchema = z.object({
  id: z.string().min(1),
  type: SourceTypeSchema,
  title: z.string().min(1).max(240),
  originLabel: z.string().min(1).max(240),
  url: z.string().url().optional(),
  fileName: z.string().max(240).optional(),
  rawTextHash: z.string().min(8),
  segments: z.array(SourceSegmentSchema),
  createdAt: z.number().int().nonnegative(),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const AgreementStatusSchema = z.enum(['consensus', 'unique', 'contradiction']);
export type AgreementStatus = z.infer<typeof AgreementStatusSchema>;

export const SourceAnchorSchema = z.object({
  sourceId: z.string().min(1),
  segmentId: z.string().min(1).optional(),
  sourceType: SourceTypeSchema,
  label: z.string().min(1).max(120),
  excerpt: z.string().max(1000),
  pageNumber: z.number().int().min(1).optional(),
  timestampSec: z.number().min(0).optional(),
  agreement: AgreementStatusSchema.optional(),
});
export type SourceAnchor = z.infer<typeof SourceAnchorSchema>;

export const NodeLensTypeSchema = z.enum([
  'eli5',
  'critic',
  'first_principles',
  'code_math',
]);
export type NodeLensType = z.infer<typeof NodeLensTypeSchema>;

export const NodeLensCardSchema = z.object({
  id: z.string().min(1),
  type: NodeLensTypeSchema,
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(2500),
  codeBlock: z
    .object({
      language: z.string().min(1).max(40),
      code: z.string().min(1).max(5000),
    })
    .optional(),
  mathLatex: z.string().max(1200).optional(),
  mermaidDiagram: z.string().max(3000).optional(),
  createdAt: z.number().int().nonnegative(),
});
export type NodeLensCard = z.infer<typeof NodeLensCardSchema>;

export const NodeMasteryStateSchema = z.enum([
  'untested',
  'mastered',
  'partial',
  'needs_review',
]);
export type NodeMasteryState = z.infer<typeof NodeMasteryStateSchema>;

export interface MindMapNode {
  id: string;
  parentId: string | null;
  topic: string;
  summary: string;
  detailedNotes?: string;
  level: number;
  children: MindMapNode[];
  anchors: SourceAnchor[];
  lenses: NodeLensCard[];
  mastery: NodeMasteryState;
  masteryScore?: number;
  masteryFeedback?: string;
  isCollapsed?: boolean;
  isClozeMasked?: boolean;
}

export const MindMapNodeSchema: z.ZodType<MindMapNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    parentId: z.string().nullable(),
    topic: z.string().min(1).max(180),
    summary: z.string().max(1500),
    detailedNotes: z.string().max(5000).optional(),
    level: z.number().int().min(0).max(16),
    children: z.array(MindMapNodeSchema),
    anchors: z.array(SourceAnchorSchema),
    lenses: z.array(NodeLensCardSchema),
    mastery: NodeMasteryStateSchema,
    masteryScore: z.number().min(0).max(100).optional(),
    masteryFeedback: z.string().max(2500).optional(),
    isCollapsed: z.boolean().optional(),
    isClozeMasked: z.boolean().optional(),
  })
);

export const LayoutModeSchema = z.enum(['balanced', 'logic_tree', 'radial', 'flowchart']);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const CrossLinkRelationSchema = z.enum([
  'causes',
  'contradicts',
  'depends_on',
  'supports',
  'bridges',
]);
export type CrossLinkRelation = z.infer<typeof CrossLinkRelationSchema>;

export const CrossLinkSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  relation: CrossLinkRelationSchema,
  label: z.string().min(1).max(60),
  rationale: z.string().min(1).max(800),
  isAiSuggested: z.boolean().optional(),
});
export type CrossLink = z.infer<typeof CrossLinkSchema>;

export const BlindSpotInsightSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  missingPerspective: z.string().min(1).max(1000),
  whyItMatters: z.string().min(1).max(1000),
  suggestedParentNodeId: z.string().min(1),
  suggestedTopic: z.string().min(1).max(160),
  suggestedSummary: z.string().min(1).max(800),
  resolved: z.boolean(),
});
export type BlindSpotInsight = z.infer<typeof BlindSpotInsightSchema>;

export const WalkthroughStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  nodeId: z.string().min(1),
  headline: z.string().min(1).max(180),
  narrative: z.string().min(1).max(1200),
  durationSec: z.number().min(1).max(120),
});
export type WalkthroughStep = z.infer<typeof WalkthroughStepSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  mode: z.enum(['ask', 'feynman']),
  content: z.string().min(1).max(12000),
  nodeId: z.string().optional(),
  nodeTopic: z.string().optional(),
  citations: z.array(SourceAnchorSchema).optional(),
  feynmanEvaluation: z
    .object({
      score: z.number().min(0).max(100),
      mastery: NodeMasteryStateSchema,
      missedConcepts: z.array(z.string()),
    })
    .optional(),
  timestamp: z.number().int().nonnegative(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const MindMapWorkspaceSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500),
  layoutMode: LayoutModeSchema,
  sources: z.array(SourceDocumentSchema),
  rootNode: MindMapNodeSchema,
  crossLinks: z.array(CrossLinkSchema),
  blindSpots: z.array(BlindSpotInsightSchema),
  walkthrough: z.array(WalkthroughStepSchema),
  chatMessages: z.array(ChatMessageSchema),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type MindMapWorkspace = z.infer<typeof MindMapWorkspaceSchema>;

export const AIProviderIdSchema = z.enum([
  'openai',
  'groq',
  'google',
  'anthropic',
  'tokens_bd',
  'ollama',
]);
export type AIProviderId = z.infer<typeof AIProviderIdSchema>;

/**
 * Prevents SSRF by permitting only HTTPS remote origins or explicit local Ollama loopback.
 */
export function isAllowedAiBaseUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      const host = parsed.hostname.toLowerCase();
      if (
        host === '169.254.169.254' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return false;
      }
      return true;
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const RuntimeAIConfigSchema = z.object({
  provider: AIProviderIdSchema,
  apiKey: z.string().max(512).optional(),
  baseUrl: z
    .string()
    .url()
    .refine(isAllowedAiBaseUrl, {
      message: 'Custom AI baseUrl must use https:// or http://localhost / http://127.0.0.1',
    })
    .optional(),
  model: z.string().max(160).optional(),
  explicitlyConfigured: z.boolean().optional(),
});
export type RuntimeAIConfig = z.infer<typeof RuntimeAIConfigSchema>;

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'AI_KEY_MISSING',
  'AI_UPSTREAM_ERROR',
  'AI_SCHEMA_INVALID',
  'SOURCE_EXTRACTION_FAILED',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const WeaveSourceInputSchema = z.object({
  type: z.enum(['topic', 'youtube', 'text']),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(50000),
});
export type WeaveSourceInput = z.infer<typeof WeaveSourceInputSchema>;

export const WeaveJsonRequestSchema = z.object({
  sources: z.array(WeaveSourceInputSchema).min(1).max(5),
});

export const ExpandNodeRequestSchema = z.object({
  workspaceTitle: z.string().min(1).max(200),
  node: z.object({
    id: z.string().min(1),
    topic: z.string().min(1).max(180),
    summary: z.string().max(1500),
  }),
  siblingTopics: z.array(z.string().max(180)).max(30).default([]),
  ancestorTopics: z.array(z.string().max(180)).max(20).default([]),
  sourceSegments: z.array(SourceSegmentSchema).max(40).optional(),
});

export const NodeLensRequestSchema = z.object({
  workspaceTitle: z.string().min(1).max(200),
  node: z.object({
    id: z.string().min(1),
    topic: z.string().min(1).max(180),
    summary: z.string().max(1500),
  }),
  lensType: NodeLensTypeSchema,
  sourceSegments: z.array(SourceSegmentSchema).max(30).optional(),
});

export const BlindSpotsRequestSchema = z.object({
  workspaceTitle: z.string().min(1).max(200),
  nodesOutline: z
    .array(
      z.object({
        id: z.string().min(1),
        parentId: z.string().nullable(),
        topic: z.string().min(1).max(180),
        summary: z.string().max(1500),
      })
    )
    .min(1)
    .max(200),
  existingCrossLinks: z.array(CrossLinkSchema).max(100).default([]),
  sourceSummary: z.string().max(12000).optional(),
});

export const StudyEvaluateRequestSchema = z.object({
  mode: z.enum(['cloze', 'feynman']),
  node: z.object({
    id: z.string().min(1),
    topic: z.string().min(1).max(180),
    summary: z.string().max(1500),
    childrenTopics: z.array(z.string().max(180)).max(30).default([]),
  }),
  userAnswer: z.string().min(1).max(4000),
  sourceSegments: z.array(SourceSegmentSchema).max(30).optional(),
});

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .max(24)
    .default([]),
  workspaceTitle: z.string().min(1).max(200),
  nodesOutline: z
    .array(
      z.object({
        id: z.string().min(1),
        topic: z.string().min(1).max(180),
        summary: z.string().max(1500),
      })
    )
    .max(200)
    .default([]),
  selectedNode: z
    .object({
      id: z.string().min(1),
      topic: z.string().min(1).max(180),
      summary: z.string().max(1500),
      childrenTopics: z.array(z.string().max(180)).max(30).default([]),
    })
    .optional(),
  sourceSegments: z.array(SourceSegmentSchema).max(40).optional(),
});
