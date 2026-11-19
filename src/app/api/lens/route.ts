import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isLiveAIConfigured, resolveRuntimeAIConfig, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { NodeLensCard, NodeLensRequestSchema } from '@/lib/schemas';

const RawLensSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  codeBlock: z
    .object({
      language: z.string().min(1).max(40),
      code: z.string().min(1).max(4000),
    })
    .optional(),
  mathLatex: z.string().max(1000).optional(),
  mermaidDiagram: z.string().max(2500).optional(),
});

function buildOfflineLens(
  lensType: 'eli5' | 'critic' | 'first_principles' | 'code_math',
  topic: string,
  summary: string
): NodeLensCard {
  const now = Date.now();
  const id = `lens_${crypto.randomUUID().slice(0, 8)}`;

  if (lensType === 'eli5') {
    return {
      id,
      type: 'eli5',
      title: `ELI5 Analogy: ${topic}`,
      summary: `Imagine ${topic} like sorting index cards on a drafting desk: ${summary || 'every card links straight to the clues that matter instead of scanning the entire shelf from scratch.'}`,
      createdAt: now,
    };
  }
  if (lensType === 'critic') {
    return {
      id,
      type: 'critic',
      title: `Critic Lens: ${topic}`,
      summary: `Key caveat for ${topic}: verify scale limits, hidden assumptions, and failure conditions where this model degrades under noisy or out-of-distribution inputs.`,
      createdAt: now,
    };
  }
  if (lensType === 'first_principles') {
    return {
      id,
      type: 'first_principles',
      title: `First Principles: ${topic}`,
      summary: `Axiom 1: Isolate the minimal conserved quantities or constraints driving ${topic}. Axiom 2: Rebuild the mechanism from raw inputs without relying on domain jargon.`,
      createdAt: now,
    };
  }

  return {
    id,
    type: 'code_math',
    title: `Formal Spec & Flow: ${topic}`,
    summary: `Structured mathematical/algorithmic view of ${topic}.`,
    mathLatex: String.raw`f(x) = \arg\min_{\theta} \mathcal{L}(x; \theta) + \lambda \Omega(\theta)`,
    codeBlock: {
      language: 'typescript',
      code: `// Conceptual pipeline for ${topic}\nexport function evaluateConcept(input: number[]): number {\n  return input.reduce((acc, v) => acc + v, 0) / Math.max(1, input.length);\n}`,
    },
    mermaidDiagram: `flowchart LR\n  A[Input] --> B[${topic.replace(/["\[\]]/g, '')}]\n  B --> C[Verified Output]`,
    createdAt: now,
  };
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'lens'), 30, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Rate limit exceeded for node lenses.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = NodeLensRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid node lens request.', requestId, 400);
  }

  const { workspaceTitle, node, lensType, sourceSegments } = parsed.data;
  const config = resolveRuntimeAIConfig(request.headers);

  try {
    if (!isLiveAIConfigured(config)) {
      return apiSuccess(
        {
          lensCard: buildOfflineLens(lensType, node.topic, node.summary),
          usedFallback: true,
        },
        requestId
      );
    }

    const lensInstruction: Record<typeof lensType, string> = {
      eli5: 'Write a concrete, memorable real-world analogy (no vague clichés).',
      critic: 'Identify sharpest counter-arguments, limitations, edge cases, or methodological flaws.',
      first_principles: 'Deconstruct into 2-3 irreducible foundational axioms and rebuild upward.',
      code_math:
        'Provide a formal KaTeX mathLatex equation, concise runnable codeBlock, and simple Mermaid flowchart string.',
    };

    const segCtx = (sourceSegments || [])
      .slice(0, 6)
      .map((s) => s.text.slice(0, 260))
      .join('\n');

    const raw = await runAICompletion({
      config,
      systemPrompt: `You transform a concept node using the "${lensType}" cognitive lens.
Directive: ${lensInstruction[lensType]}
Return ONLY valid JSON:
{
  "title": "Concise lens title",
  "summary": "Clear 2-4 sentence insight",
  "mathLatex": "optional KaTeX string without $$ wrappers",
  "codeBlock": { "language": "python", "code": "..." },
  "mermaidDiagram": "optional flowchart LR ..."
}`,
      userPrompt: `Workspace: "${workspaceTitle}"\nNode: "${node.topic}"\nSummary: "${node.summary}"\n${segCtx ? `Sources:\n${segCtx}` : ''}`,
      temperature: 0.4,
    });

    const validated = extractAndValidateJson(raw, RawLensSchema);
    if (!validated.ok) {
      return apiError('AI_SCHEMA_INVALID', validated.error, requestId, 502);
    }

    const lensCard: NodeLensCard = {
      id: `lens_${crypto.randomUUID().slice(0, 8)}`,
      type: lensType,
      ...validated.data,
      createdAt: Date.now(),
    };

    logger.info('lens.completed', { requestId, nodeId: node.id, lensType });
    return apiSuccess({ lensCard, usedFallback: false }, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate lens';
    logger.error('lens.failed', { requestId, errorMessage: message });
    return apiError('AI_UPSTREAM_ERROR', message, requestId, 502);
  }
}
