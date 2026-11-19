import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isLiveAIConfigured, resolveRuntimeAIConfig, runAICompletion } from '@/lib/ai/gateway';
import { extractAndValidateJson } from '@/lib/ai/json-guard';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { NodeMasteryState, NodeMasteryStateSchema, StudyEvaluateRequestSchema } from '@/lib/schemas';

const RawEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  mastery: NodeMasteryStateSchema,
  feedback: z.string().min(1).max(1500),
  missedConcepts: z.array(z.string().max(180)).max(6).default([]),
});

function evaluateOffline(
  mode: 'cloze' | 'feynman',
  topic: string,
  summary: string,
  childrenTopics: string[],
  userAnswer: string
): {
  score: number;
  mastery: NodeMasteryState;
  feedback: string;
  missedConcepts: string[];
} {
  const answerLower = userAnswer.toLowerCase();
  const referenceCorpus = `${topic} ${summary} ${childrenTopics.join(' ')}`.toLowerCase();
  const keyTokens = Array.from(
    new Set(
      referenceCorpus
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4)
    )
  );

  const matched = keyTokens.filter((t) => answerLower.includes(t));
  const recallRatio = keyTokens.length > 0 ? matched.length / Math.min(keyTokens.length, 8) : 0.5;
  const lengthBonus = userAnswer.trim().split(/\s+/).length >= 8 ? 15 : 0;
  const score = Math.min(100, Math.max(20, Math.round(recallRatio * 80 + lengthBonus)));

  const mastery: NodeMasteryState =
    score >= 78 ? 'mastered' : score >= 48 ? 'partial' : 'needs_review';

  const missedConcepts = childrenTopics.filter(
    (child) =>
      !child
        .toLowerCase()
        .split(/\W+/)
        .some((w) => w.length >= 4 && answerLower.includes(w))
  );

  const feedback =
    mastery === 'mastered'
      ? `Strong ${mode === 'cloze' ? 'recall' : 'Feynman explanation'} on "${topic}". You captured the core mechanism clearly.`
      : mastery === 'partial'
        ? `Partial grasp of "${topic}" (${score}/100). Revisit how "${summary}" connects to its sub-branches.`
        : `Needs review (${score}/100). Try explaining the core mechanism of "${topic}" in concrete cause-and-effect terms.`;

  return {
    score,
    mastery,
    feedback,
    missedConcepts: missedConcepts.slice(0, 4),
  };
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'study'), 40, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Rate limit exceeded for study evaluation.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = StudyEvaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid study evaluation request.', requestId, 400);
  }

  const { mode, node, userAnswer, sourceSegments } = parsed.data;
  const config = resolveRuntimeAIConfig(request.headers);

  try {
    if (!isLiveAIConfigured(config)) {
      const offline = evaluateOffline(
        mode,
        node.topic,
        node.summary,
        node.childrenTopics,
        userAnswer
      );
      return apiSuccess({ ...offline, usedFallback: true }, requestId);
    }

    const segCtx = (sourceSegments || [])
      .slice(0, 6)
      .map((s) => s.text.slice(0, 250))
      .join('\n');

    const raw = await runAICompletion({
      config,
      systemPrompt: `You are a rigorous yet encouraging Feynman tutor grading a learner's ${mode === 'cloze' ? 'Active Recall attempt' : 'plain-language explanation'}.
Return ONLY valid JSON:
{
  "score": 0 to 100 integer,
  "mastery": "mastered" (score >= 80) | "partial" (45-79) | "needs_review" (< 45),
  "feedback": "2-3 concise sentences pointing out what they nailed and what to sharpen",
  "missedConcepts": ["concise missed concept 1", "..."]
}`,
      userPrompt: `Concept: "${node.topic}"
Reference Summary: "${node.summary}"
Sub-concepts: ${node.childrenTopics.join(', ') || 'None'}
${segCtx ? `Source Evidence:\n${segCtx}\n` : ''}
Learner's Response:\n"${userAnswer}"`,
      temperature: 0.25,
    });

    const validated = extractAndValidateJson(raw, RawEvaluationSchema);
    if (!validated.ok) {
      return apiError('AI_SCHEMA_INVALID', validated.error, requestId, 502);
    }

    logger.info('study.evaluated', {
      requestId,
      nodeId: node.id,
      mode,
      score: validated.data.score,
    });
    return apiSuccess({ ...validated.data, usedFallback: false }, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Study evaluation failed';
    logger.error('study.failed', { requestId, errorMessage: message });
    return apiError('AI_UPSTREAM_ERROR', message, requestId, 502);
  }
}
