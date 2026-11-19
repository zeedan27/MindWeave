import {
  MindMapWorkspace,
  MindMapWorkspaceSchema,
  RuntimeAIConfig,
  RuntimeAIConfigSchema,
} from '@/lib/schemas';

const DB_NAME = 'mindweave_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const LS_WORKSPACES_KEY = 'mindweave_workspaces_v1';
const LS_BYOK_KEY = 'mindweave_byok_config_v1';

export function encodeUtf8Base64(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeUtf8Base64(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

function readLocalFallbackList(): MindMapWorkspace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_WORKSPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => MindMapWorkspaceSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeLocalFallbackList(list: MindMapWorkspace[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_WORKSPACES_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota errors on fallback storage
  }
}

export async function listSavedWorkspaces(): Promise<MindMapWorkspace[]> {
  try {
    const db = await openWorkspaceDb();
    return await new Promise<MindMapWorkspace[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || [])
          .map((item) => MindMapWorkspaceSchema.safeParse(item))
          .filter((r) => r.success)
          .map((r) => r.data)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readLocalFallbackList();
  }
}

export async function saveWorkspaceToStorage(workspace: MindMapWorkspace): Promise<void> {
  const updated: MindMapWorkspace = { ...workspace, updatedAt: Date.now() };
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage below
  }

  const current = readLocalFallbackList().filter((w) => w.id !== updated.id);
  writeLocalFallbackList([updated, ...current].slice(0, 40));
}

export async function deleteWorkspaceFromStorage(id: string): Promise<void> {
  try {
    const db = await openWorkspaceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback below
  }

  const current = readLocalFallbackList().filter((w) => w.id !== id);
  writeLocalFallbackList(current);
}

export function loadByokConfig(): RuntimeAIConfig {
  const fallback: RuntimeAIConfig = {
    provider: 'openai',
    explicitlyConfigured: false,
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(LS_BYOK_KEY);
    if (!raw) return fallback;
    const parsed = RuntimeAIConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function saveByokConfig(config: RuntimeAIConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_BYOK_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage restriction errors
  }
}

export function encodeByokHeader(config: RuntimeAIConfig): string | null {
  if (!config.apiKey && config.provider !== 'ollama') return null;
  if (config.provider === 'ollama' && !config.explicitlyConfigured) return null;
  return encodeUtf8Base64(
    JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
    })
  );
}

export function encodeWorkspaceHash(workspace: MindMapWorkspace): string {
  const json = JSON.stringify(workspace);
  const b64 = encodeUtf8Base64(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `#mw=${b64}`;
}

export function decodeWorkspaceHash(hash: string): MindMapWorkspace | null {
  try {
    const trimmed = hash.trim().replace(/^#/, '');
    if (!trimmed.startsWith('mw=')) return null;
    let b64 = trimmed.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const json = decodeUtf8Base64(b64);
    const parsed = MindMapWorkspaceSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
