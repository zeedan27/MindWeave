import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import katex from 'katex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Handshake assertion failed: ${message}`);
  }
}

async function verifyGovernanceAndSecrets() {
  const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  const envLines = envExample
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  for (const line of envLines) {
    assert(/^[A-Z0-9_]+=$/.test(line), `.env.example must contain empty keys only, found: ${line}`);
  }

  const mcpRaw = fs.readFileSync(path.join(rootDir, '.agents', 'mcp_config.json'), 'utf8');
  const mcpConfig = JSON.parse(mcpRaw);
  assert(!/Bearer\s+|sk-|gsk_|tok_live_|AIza/i.test(mcpRaw), '.agents/mcp_config.json must contain zero secrets');
  assert(
    Array.isArray(mcpConfig?.mcpServers?.playwright?.disabledTools) &&
      mcpConfig.mcpServers.playwright.disabledTools.includes('browser_run_code_unsafe'),
    'Playwright MCP must disable browser_run_code_unsafe'
  );

  const uiRule = fs.readFileSync(path.join(rootDir, '.agents', 'rules', 'ui-components.md'), 'utf8');
  assert(/^---\r?\ntrigger:\s*glob\b/m.test(uiRule), 'ui-components.md must define valid trigger: glob frontmatter');

  for (const doc of ['PRODUCT.md', 'DESIGN.md', path.join('architecture', 'schemas.md')]) {
    assert(fs.existsSync(path.join(rootDir, doc)), `Required specification missing: ${doc}`);
  }

  const designSidecar = JSON.parse(
    fs.readFileSync(path.join(rootDir, '.impeccable', 'design.json'), 'utf8')
  );
  assert(designSidecar.schemaVersion === 2, '.impeccable/design.json must have schemaVersion 2');

  console.log('[PASS] 1. Governance & Secret Hygiene Handshake');
}

async function verifyElkLayout() {
  const elkMod = await import('elkjs/lib/elk.bundled.js');
  const ELK = elkMod.default || elkMod;
  const elk = new ELK();

  const makeGraph = (algorithm) => ({
    id: 'root-graph',
    layoutOptions: {
      'elk.algorithm': algorithm,
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
    },
    children: [
      { id: 'root', width: 220, height: 80 },
      { id: 'c1', width: 200, height: 70 },
      { id: 'c2', width: 200, height: 70 },
    ],
    edges: [
      { id: 'e1', sources: ['root'], targets: ['c1'] },
      { id: 'e2', sources: ['root'], targets: ['c2'] },
    ],
  });

  for (const algo of ['layered', 'radial']) {
    const laidOut = await elk.layout(makeGraph(algo));
    assert(Array.isArray(laidOut.children) && laidOut.children.length === 3, `ELK ${algo} did not return 3 nodes`);

    const coords = new Set();
    for (const child of laidOut.children) {
      assert(Number.isFinite(child.x) && Number.isFinite(child.y), `ELK ${algo} returned non-finite coordinates`);
      const key = `${Math.round(child.x)}:${Math.round(child.y)}`;
      assert(!coords.has(key), `ELK ${algo} produced overlapping node positions at ${key}`);
      coords.add(key);
    }
  }

  console.log('[PASS] 2. Spatial Layout Engine Handshake (elkjs layered + radial)');
}

async function verifyPdfAndKatex() {
  const pdfMod = await import('pdf-parse');
  assert(
    typeof pdfMod.PDFParse === 'function' || typeof pdfMod.default === 'function',
    'pdf-parse must expose PDFParse or parser function'
  );

  const html = katex.renderToString('E = mc^2', { throwOnError: true });
  assert(typeof html === 'string' && html.includes('katex'), 'KaTeX failed to render math expression');

  console.log('[PASS] 3. Document & Math Parsing Handshake (pdf-parse + katex)');
}

function isAllowedAiBaseUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol === 'https:') return true;
  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  ) {
    return true;
  }
  return false;
}

function redactSecrets(record) {
  const sensitiveKeys = new Set(['apikey', 'api_key', 'authorization', 'x-mindweave-ai-config']);
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSecrets(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function verifySchemasAndRedaction() {
  const RuntimeAIConfigSchema = z.object({
    provider: z.enum(['openai', 'groq', 'google', 'anthropic', 'tokens_bd', 'ollama']),
    apiKey: z.string().max(512).optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().max(128).optional(),
  });

  const sampleConfig = RuntimeAIConfigSchema.parse({
    provider: 'tokens_bd',
    apiKey: 'tok_live_example_dummy',
    baseUrl: 'https://tokens.bd/v1',
    model: 'deepseek-ai/deepseek-v4.1-flash-1017',
  });
  assert(sampleConfig.provider === 'tokens_bd', 'RuntimeAIConfig parse mismatch');

  assert(isAllowedAiBaseUrl('https://tokens.bd/v1') === true, 'HTTPS Tokens.bd URL must be allowed');
  assert(isAllowedAiBaseUrl('http://localhost:11434/v1') === true, 'Localhost Ollama URL must be allowed');
  assert(isAllowedAiBaseUrl('http://169.254.169.254/latest/meta-data') === false, 'Metadata SSRF URL must be blocked');
  assert(isAllowedAiBaseUrl('http://example.com/v1') === false, 'Insecure remote HTTP URL must be blocked');

  const redacted = redactSecrets({
    requestId: 'req_123',
    apiKey: 'secret-value-never-log',
    headers: { 'x-mindweave-ai-config': 'base64secret' },
  });
  assert(redacted.apiKey === '[REDACTED]', 'apiKey was not redacted');
  assert(redacted.headers['x-mindweave-ai-config'] === '[REDACTED]', 'x-mindweave-ai-config was not redacted');

  const WorkspaceSampleSchema = z.object({
    id: z.string().min(1),
    schemaVersion: z.literal(1),
    title: z.string().min(1),
    layoutMode: z.enum(['balanced', 'logic_tree', 'radial', 'flowchart']),
  });
  WorkspaceSampleSchema.parse({
    id: 'ws_demo',
    schemaVersion: 1,
    title: 'Attention Mechanisms',
    layoutMode: 'balanced',
  });

  console.log('[PASS] 4. Schema Validation, SSRF Guard & Secret Redaction Handshake');
}

async function verifyAiReadinessMode() {
  const envPath = path.join(rootDir, '.env');
  let hasServerKey = Boolean(process.env.AI_API_KEY);
  if (!hasServerKey && fs.existsSync(envPath)) {
    const rawEnv = fs.readFileSync(envPath, 'utf8');
    hasServerKey = /^AI_API_KEY=.+/m.test(rawEnv);
  }

  const mode = hasServerKey ? 'ENV_CONFIGURED' : 'BYOK + INTERACTIVE_DEMO_READY';
  console.log(`[PASS] 5. AI Provider & Fallback Readiness Handshake (mode=${mode})`);
}

async function main() {
  await verifyGovernanceAndSecrets();
  await verifyElkLayout();
  await verifyPdfAndKatex();
  await verifySchemasAndRedaction();
  await verifyAiReadinessMode();
  console.log('ALL_PHASE_2_HANDSHAKES_PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
