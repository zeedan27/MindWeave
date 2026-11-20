import { NextRequest } from 'next/server';
import { isLiveAIConfigured, resolveRuntimeAIConfig, runAICompletion } from '@/lib/ai/gateway';
import { formatTimestampSec } from '@/lib/demo-workspace';
import { rankRelevantSegments } from '@/lib/ingestion/segment-ranker';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { ChatRequestSchema, SourceAnchor, SourceSegment } from '@/lib/schemas';

function findMatchingCitations(
  query: string,
  segments?: SourceSegment[]
): SourceAnchor[] {
  if (!segments || segments.length === 0) return [];
  const top = rankRelevantSegments(query, segments, 2);

  return top.map((seg) => ({
    sourceId: seg.sourceId,
    segmentId: seg.id,
    sourceType: seg.startSec !== undefined ? 'youtube' : seg.pageNumber ? 'pdf' : 'text',
    label:
      seg.startSec !== undefined
        ? `▶ ${formatTimestampSec(seg.startSec)}`
        : seg.pageNumber
          ? `Page ${seg.pageNumber}`
          : seg.heading || 'Source Segment',
    excerpt: seg.text.slice(0, 240),
    pageNumber: seg.pageNumber,
    timestampSec: seg.startSec,
  }));
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'chat'), 40, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Rate limit exceeded for chat.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid chat request payload.', requestId, 400);
  }

  const { message, history, workspaceTitle, nodesOutline, selectedNode, sourceSegments } =
    parsed.data;
  const config = resolveRuntimeAIConfig(request.headers);
  const citations = findMatchingCitations(
    `${selectedNode?.topic || ''} ${message}`,
    sourceSegments
  );

  try {
    if (!isLiveAIConfigured(config)) {
      const focusTitle = selectedNode ? selectedNode.topic : workspaceTitle;
      const focusSummary = selectedNode
        ? selectedNode.summary
        : `Covers ${nodesOutline.slice(0, 5).map((n) => n.topic).join(', ')}.`;
      const excerptNote =
        citations.length > 0
          ? `\n\n**Grounded Excerpt (${citations[0].label}):**\n> ${citations[0].excerpt}`
          : '';

      const reply = `**${focusTitle}**\n\n${focusSummary}${excerptNote}\n\n*(Offline grounded preview — configure an API key in Settings to run full multi-turn synthesis on "${message.slice(0, 80)}".)*`;
      return apiSuccess({ reply, citations, usedFallback: true }, requestId);
    }

    const rankedSegments = rankRelevantSegments(
      `${selectedNode?.topic || ''} ${selectedNode?.summary || ''} ${message}`,
      sourceSegments || [],
      8
    );
    const segCtx = rankedSegments
      .map((s) => {
        const tag =
          s.startSec !== undefined
            ? `▶ ${formatTimestampSec(s.startSec)}`
            : s.pageNumber
              ? `Page ${s.pageNumber}`
              : s.heading || 'Note';
        const headingSuffix = s.heading && s.pageNumber ? ` | ${s.heading}` : '';
        return `[${tag}${headingSuffix}] ${s.text.slice(0, 520)}`;
      })
      .join('\n');

    const reply = await runAICompletion({
      config,
      history,
      systemPrompt: `You are MindWeave's Socratic learning assistant.
- Be concise, structured (2-3 short paragraphs or tight bullets), and grounded in the supplied workspace and source excerpts.
- Cite page numbers or timestamps inline when referencing source segments.
- Never output raw HTML.`,
      userPrompt: `Workspace: "${workspaceTitle}"
Map Overview: ${nodesOutline.slice(0, 20).map((n) => n.topic).join(', ')}
${selectedNode ? `Selected Node: "${selectedNode.topic}" — ${selectedNode.summary}\nSub-topics: ${selectedNode.childrenTopics.join(', ') || 'None'}` : ''}
${segCtx ? `\nSource Segments:\n${segCtx}` : ''}

Question: ${message}`,
      temperature: 0.5,
    });

    logger.info('chat.completed', { requestId, hasSelection: Boolean(selectedNode) });
    return apiSuccess({ reply, citations, usedFallback: false }, requestId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chat completion failed';
    logger.error('chat.failed', { requestId, errorMessage: msg });
    return apiError('AI_UPSTREAM_ERROR', msg, requestId, 502);
  }
}
