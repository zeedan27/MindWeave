import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ApiErrorCode } from '@/lib/schemas';

const SENSITIVE_KEY_PATTERN =
  /^(apikey|api_key|authorization|x-mindweave-ai-config|token|secret|password)$/i;

export function createRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Recursively masks secret fields before structured log emission.
 */
export function redactSecrets(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item));
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = redactSecrets(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emitLog(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ? (redactSecrets(data) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => emitLog('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emitLog('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emitLog('error', event, data),
};

export function apiSuccess<T>(data: T, requestId: string, status = 200): NextResponse {
  return NextResponse.json(
    { ok: true, data, requestId },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'x-request-id': requestId,
      },
    }
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  status: number,
  extra?: { details?: Record<string, unknown>; retryAfterSec?: number }
): NextResponse {
  const headers: Record<string, string> = {
    'Cache-Control': 'private, no-store',
    'x-request-id': requestId,
  };
  if (extra?.retryAfterSec !== undefined) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil(extra.retryAfterSec)));
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        requestId,
        ...(extra?.details ? { details: redactSecrets(extra.details) } : {}),
        ...(extra?.retryAfterSec !== undefined ? { retryAfterSec: extra.retryAfterSec } : {}),
      },
    },
    { status, headers }
  );
}
