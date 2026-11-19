import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Gate 2 check failed: ${message}`);
  }
}

const SECRET_PATTERNS = [
  /sk-(?!proj-sample|test-)[A-Za-z0-9]{20,}/,
  /gsk_[A-Za-z0-9]{20,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /tok_live_[A-Za-z0-9]{16,}/,
];

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function checkSecretsAndGitHistory() {
  const trackedRaw = execFileSync('git', ['ls-files'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  const trackedFiles = trackedRaw
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);

  for (const relPath of trackedFiles) {
    assert(
      !/(^|\/)\.env($|\.(?!example$))/.test(relPath),
      `Sensitive .env file is tracked in git: ${relPath}`
    );
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|example|css|html)$/i.test(relPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      assert(!pattern.test(content), `Potential secret matched in tracked file ${relPath}`);
    }
  }

  const historyPatch = execFileSync('git', ['log', '-p', '-n', '20', '--', '.'], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
  });
  for (const pattern of SECRET_PATTERNS) {
    assert(!pattern.test(historyPatch), `Potential secret matched in git history (${pattern})`);
  }

  const staticAssets = walkFiles(path.join(rootDir, '.next', 'static')).filter(
    (p) => p.endsWith('.js') || p.endsWith('.css')
  );
  for (const assetPath of staticAssets) {
    const content = fs.readFileSync(assetPath, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      assert(!pattern.test(content), `Potential secret exposed in client bundle ${assetPath}`);
    }
  }

  console.log(
    `[PASS] 1. Secret Scan (${trackedFiles.length} tracked files, git log -20, ${staticAssets.length} static assets)`
  );
}

function checkEnvAndGitignoreHygiene() {
  const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  for (const expectedKey of ['AI_PROVIDER=', 'AI_API_KEY=', 'AI_BASE_URL=', 'AI_MODEL=', 'DATABASE_URL=']) {
    assert(envExample.includes(expectedKey), `.env.example missing expected key ${expectedKey}`);
  }

  const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  for (const expectedIgnore of ['.env*', '.next/', '.tmp/']) {
    assert(gitignore.includes(expectedIgnore), `.gitignore missing ignore rule ${expectedIgnore}`);
  }

  console.log('[PASS] 2. Env Template & .gitignore Hygiene');
}

function checkDocsAndCiCompleteness() {
  const requiredFiles = [
    'AGENTS.md',
    'task_plan.md',
    'findings.md',
    'progress.md',
    'PRODUCT.md',
    'DESIGN.md',
    path.join('architecture', 'schemas.md'),
    path.join('architecture', 'decisions.md'),
    path.join('architecture', 'maintenance.md'),
    path.join('.github', 'workflows', 'ci.yml'),
  ];

  for (const relPath of requiredFiles) {
    assert(fs.existsSync(path.join(rootDir, relPath)), `Missing required deliverable: ${relPath}`);
  }

  const maintenance = fs.readFileSync(path.join(rootDir, 'architecture', 'maintenance.md'), 'utf8');
  for (const marker of ['/api/healthz/live', '/api/healthz/ready', 'Rollback', 'Secret Rotation', 'Revisit']) {
    assert(maintenance.includes(marker), `architecture/maintenance.md missing section/marker: ${marker}`);
  }

  console.log('[PASS] 3. Documentation, Runbook & CI Config Completeness');
}

function checkSecurityAndGuardrails() {
  const schemasSrc = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'schemas.ts'), 'utf8');
  assert(schemasSrc.includes('export function isAllowedAiBaseUrl'), 'Missing SSRF URL validator');

  const extractorsSrc = fs.readFileSync(
    path.join(rootDir, 'src', 'lib', 'ingestion', 'extractors.ts'),
    'utf8'
  );
  assert(
    extractorsSrc.includes('[a-zA-Z0-9_-]{11}'),
    'Missing 11-char YouTube video ID allowlist guard'
  );

  const weaveRouteSrc = fs.readFileSync(
    path.join(rootDir, 'src', 'app', 'api', 'weave', 'route.ts'),
    'utf8'
  );
  assert(weaveRouteSrc.includes('MAX_FILE_BYTES = 20 * 1024 * 1024'), 'Missing 20 MB upload ceiling');

  const loggerSrc = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'logger.ts'), 'utf8');
  assert(
    loggerSrc.includes('redactSecrets') && loggerSrc.includes('x-mindweave-ai-config'),
    'Missing logger redaction for BYOK header/secrets'
  );

  console.log('[PASS] 4. Security Boundaries, SSRF Guard & Logger Redaction');
}

function checkHealthProbesAndRateLimiting() {
  const healthSrc = fs.readFileSync(
    path.join(rootDir, 'src', 'app', 'api', 'healthz', '[probe]', 'route.ts'),
    'utf8'
  );
  assert(
    healthSrc.includes("probe === 'live'") &&
      healthSrc.includes("probe === 'ready'") &&
      healthSrc.includes("'Cache-Control': 'private, no-store'"),
    'Health probe route must implement live/ready probes with private, no-store caching'
  );

  const rateLimitSrc = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'rate-limit.ts'), 'utf8');
  assert(
    rateLimitSrc.includes('checkRateLimit') && rateLimitSrc.includes('retryAfterSec'),
    'Rate limiter must export checkRateLimit and compute retryAfterSec'
  );

  console.log('[PASS] 5. Health Probes & Rate-Limit Contracts');
}

checkSecretsAndGitHistory();
checkEnvAndGitignoreHygiene();
checkDocsAndCiCompleteness();
checkSecurityAndGuardrails();
checkHealthProbesAndRateLimiting();
console.log('ALL_GATE_2_CHECKS_PASSED');
