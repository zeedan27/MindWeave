import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRuntimeAIConfig } from '@/lib/ai/gateway';
import {
  extractFromPdfBuffer,
  extractFromText,
  extractFromYouTube,
} from '@/lib/ingestion/extractors';
import { weaveSourcesToWorkspace } from '@/lib/ingestion/weaver';
import { apiError, apiSuccess, createRequestId, logger } from '@/lib/logger';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { SourceDocument, WeaveJsonRequestSchema } from '@/lib/schemas';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md']);

const FormSourceMetaSchema = z.array(
  z.object({
    type: z.enum(['topic', 'youtube', 'text']),
    title: z.string().max(200).optional(),
    content: z.string().min(1).max(50000),
  })
);

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const rl = checkRateLimit(getClientRateLimitKey(request.headers, 'weave'), 30, 60_000);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Too many weave requests. Please wait shortly.', requestId, 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const extractedSources: SourceDocument[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawMeta = formData.get('sourcesMeta');
      if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
        let metaJson: unknown;
        try {
          metaJson = JSON.parse(rawMeta);
        } catch {
          return apiError('VALIDATION_ERROR', 'Invalid sourcesMeta JSON.', requestId, 400);
        }
        const parsedMeta = FormSourceMetaSchema.safeParse(metaJson);
        if (!parsedMeta.success) {
          return apiError('VALIDATION_ERROR', 'Invalid source entry metadata.', requestId, 400);
        }

        const metaResults = await Promise.all(
          parsedMeta.data.map(async (item) => {
            if (item.type === 'youtube') return extractFromYouTube(item.content);
            return extractFromText(item.content, item.title || '', item.type);
          })
        );
        extractedSources.push(...metaResults);
      }

      const files = formData
        .getAll('files')
        .filter((entry): entry is File => entry instanceof File);

      for (const file of files) {
        const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return apiError(
            'UNSUPPORTED_FILE_TYPE',
            `Unsupported file "${file.name}". Only PDF, TXT, and MD are allowed.`,
            requestId,
            400
          );
        }
        if (file.size > MAX_FILE_BYTES) {
          return apiError(
            'FILE_TOO_LARGE',
            `File "${file.name}" exceeds the 20MB limit.`,
            requestId,
            413
          );
        }

        if (ext === '.pdf') {
          const buf = Buffer.from(await file.arrayBuffer());
          extractedSources.push(await extractFromPdfBuffer(buf, file.name));
        } else {
          const text = await file.text();
          extractedSources.push(
            extractFromText(text, file.name.replace(/\.[^.]+$/, ''), 'text', file.name)
          );
        }
      }
    } else {
      const body = await request.json().catch(() => null);
      const parsed = WeaveJsonRequestSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          'VALIDATION_ERROR',
          'Provide 1 to 5 valid sources (topic, youtube, or text).',
          requestId,
          400
        );
      }

      const results = await Promise.all(
        parsed.data.sources.map(async (item) => {
          if (item.type === 'youtube') return extractFromYouTube(item.content);
          return extractFromText(item.content, item.title || '', item.type);
        })
      );
      extractedSources.push(...results);
    }

    if (extractedSources.length === 0 || extractedSources.length > 5) {
      return apiError(
        'VALIDATION_ERROR',
        'Please supply between 1 and 5 sources to weave.',
        requestId,
        400
      );
    }

    const runtimeConfig = resolveRuntimeAIConfig(request.headers);
    const result = await weaveSourcesToWorkspace(extractedSources, runtimeConfig);

    logger.info('weave.completed', {
      requestId,
      sourceCount: extractedSources.length,
      usedFallback: result.usedFallback,
      provider: runtimeConfig.provider,
    });

    return apiSuccess(result, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to synthesize sources.';
    logger.error('weave.failed', { requestId, errorMessage: message });
    if (message.startsWith('AI_SCHEMA_INVALID:')) {
      return apiError('AI_SCHEMA_INVALID', message.replace('AI_SCHEMA_INVALID:', ''), requestId, 502);
    }
    return apiError('SOURCE_EXTRACTION_FAILED', message, requestId, 422);
  }
}
