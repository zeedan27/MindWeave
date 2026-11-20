import { z } from 'zod';

/**
 * Extracts a balanced JSON object or array from raw LLM text, stripping outer markdown fences
 * without truncating when string values themselves contain triple backticks.
 */
export function extractJsonSubstring(raw: string): string {
  const trimmed = raw.trim();
  const firstObjRaw = trimmed.indexOf('{');
  const firstArrRaw = trimmed.indexOf('[');
  const firstRawBrace =
    firstObjRaw !== -1 && firstArrRaw !== -1
      ? Math.min(firstObjRaw, firstArrRaw)
      : Math.max(firstObjRaw, firstArrRaw);

  const fenceOpen = trimmed.match(/```(?:json)?\s*(?=[{\[])/i);
  const candidate =
    fenceOpen &&
    fenceOpen.index !== undefined &&
    (firstRawBrace === -1 || fenceOpen.index < firstRawBrace)
      ? trimmed.slice(fenceOpen.index + fenceOpen[0].length)
      : trimmed;

  const firstObj = candidate.indexOf('{');
  const firstArr = candidate.indexOf('[');
  let start = -1;
  if (firstObj !== -1 && firstArr !== -1) {
    start = Math.min(firstObj, firstArr);
  } else {
    start = Math.max(firstObj, firstArr);
  }

  if (start === -1) {
    return candidate;
  }

  const openChar = candidate[start];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return candidate.slice(start, i + 1);
      }
    }
  }

  return candidate.slice(start).replace(/\r?\n?```\s*$/, '');
}

function stripTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j += 1;
      if (input[j] === '}' || input[j] === ']') {
        continue;
      }
    }
    out += ch;
  }

  return out;
}

/**
 * Normalizes unescaped control characters and invalid escape sequences inside JSON strings,
 * and removes trailing commas outside strings.
 */
export function sanitizeJsonText(input: string): string {
  let out = '';
  let inString = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (ch === '\\') {
      if (i + 1 >= input.length) {
        continue;
      }
      const next = input[i + 1];
      if ('"\\/bfnrt'.includes(next)) {
        out += '\\' + next;
        i += 1;
      } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
        out += input.slice(i, i + 6);
        i += 5;
      } else {
        out += '\\\\';
      }
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += '"';
      continue;
    }
    if (ch === '\r') {
      if (input[i + 1] === '\n') {
        i += 1;
        out += '\\n';
      } else {
        out += '\\r';
      }
      continue;
    }
    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }
    if (ch.charCodeAt(0) < 0x20) {
      continue;
    }
    out += ch;
  }

  return stripTrailingCommas(out);
}

function closeOpenContainers(snippet: string): string | null {
  if (!snippet.trim()) return null;

  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < snippet.length; i += 1) {
    const ch = snippet[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' && stack[stack.length - 1] === '{') {
      stack.pop();
    } else if (ch === ']' && stack[stack.length - 1] === '[') {
      stack.pop();
    }
  }

  let out = snippet;
  if (inString) {
    if (escaped) out = out.slice(0, -1);
    out += '"';
  }

  out = out.trimEnd();
  while (out.endsWith(',')) {
    out = out.slice(0, -1).trimEnd();
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    out += stack[i] === '{' ? '}' : ']';
  }

  return out;
}

function collectRollbackIndices(sanitized: string): number[] {
  const cuts: number[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < sanitized.length; i += 1) {
    const ch = sanitized[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === ',') {
      cuts.push(i);
    } else if (ch === '{' || ch === '[') {
      cuts.push(i + 1);
    }
  }

  return cuts.reverse().slice(0, 20);
}

function validateParsed<T>(
  parsed: unknown,
  schema: z.ZodType<T>
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `Schema mismatch: ${issues}` };
  }
  return { ok: true, data: result.data };
}

export function extractAndValidateJson<T>(
  rawText: string,
  schema: z.ZodType<T>
): { ok: true; data: T } | { ok: false; error: string } {
  const extracted = extractJsonSubstring(rawText);

  try {
    return validateParsed(JSON.parse(extracted), schema);
  } catch {
    // Fall through to string/comma sanitization
  }

  const sanitized = sanitizeJsonText(extracted);
  let parseError = 'Invalid JSON payload';

  try {
    return validateParsed(JSON.parse(sanitized), schema);
  } catch (err) {
    parseError = err instanceof Error ? `Invalid JSON payload: ${err.message}` : 'Invalid JSON payload';
  }

  const candidates = [
    closeOpenContainers(sanitized),
    ...collectRollbackIndices(sanitized).map((idx) =>
      closeOpenContainers(sanitized.slice(0, idx).trimEnd())
    ),
  ];

  let firstSchemaError: string | null = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const checked = validateParsed(parsed, schema);
      if (checked.ok) return checked;
      if (!firstSchemaError) firstSchemaError = checked.error;
    } catch {
      // Try earlier rollback boundary
    }
  }

  return { ok: false, error: firstSchemaError || parseError };
}
