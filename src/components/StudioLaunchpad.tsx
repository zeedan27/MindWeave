'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clock,
  FileText,
  KeyRound,
  Moon,
  Play,
  Sun,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react';
import type { MindMapWorkspace } from '@/lib/schemas';
import { flattenNodesOutline, useWorkspaceStore } from '@/store/workspace-store';
import MultiSourceTray from './MultiSourceTray';

function formatRelativeTime(ts: number): string {
  const diffMins = Math.floor((Date.now() - ts) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function StudioLaunchpad() {
  const {
    savedWorkspaces,
    serverAiReady,
    byokConfig,
    isWeaving,
    isInitializing,
    errorMessage,
    dismissError,
    setByokModalOpen,
    loadDemoWorkspace,
    openSavedWorkspace,
    deleteSavedWorkspace,
    importWorkspaceJson,
    weaveNewWorkspace,
  } = useWorkspaceStore();

  const [isDark, setIsDark] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('mindweave_theme_v1', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const handleImportJson = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    await importWorkspaceJson(text);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
      >
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="var(--mw-primary)" />
              <circle cx="9" cy="14" r="2.5" fill="var(--mw-primary-ink)" />
              <circle cx="19" cy="8.5" r="2.2" fill="var(--mw-primary-ink)" />
              <circle cx="19" cy="19.5" r="2.2" fill="var(--mw-primary-ink)" />
              <path
                d="M11.2 13L16.8 9.5M11.2 15L16.8 18.5"
                stroke="var(--mw-primary-ink)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-base font-semibold tracking-tight">MindWeave</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setByokModalOpen(true)}
              className="h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--mw-card)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            >
              <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--mw-primary)' }} />
              <span>
                {serverAiReady
                  ? `AI: ${byokConfig.explicitlyConfigured ? byokConfig.provider : 'Server Ready'}`
                  : 'Configure AI Key'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg border flex items-center justify-center"
              style={{
                backgroundColor: 'var(--mw-card)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
              aria-label={isDark ? 'Switch to light drafting paper' : 'Switch to midnight blueprint'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-workspace" className="flex-1">
        {/* Error Banner (Partial Error State) */}
        {errorMessage && (
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 pt-4">
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm"
              style={{
                backgroundColor: 'var(--mw-crimson-bg)',
                borderColor: 'var(--mw-crimson)',
                color: 'var(--mw-crimson)',
              }}
              role="alert"
            >
              <span>{errorMessage}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setByokModalOpen(true)}
                  className="px-2.5 py-1 rounded-md border text-xs font-semibold"
                  style={{ borderColor: 'var(--mw-crimson)', backgroundColor: 'var(--mw-card)' }}
                >
                  Open AI Settings
                </button>
                <button
                  type="button"
                  onClick={dismissError}
                  className="text-xs font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero-Collage Section */}
        <section className="max-w-[1380px] mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 6 columns: Core Thesis + Multi-Source Synthesis Tray */}
            <div className="lg:col-span-6 space-y-5">
              <h1
                className="text-4xl sm:text-5xl font-medium leading-[1.05] tracking-[-0.035em]"
                style={{ color: 'var(--mw-ink)' }}
              >
                Weave papers, lectures, and notes into living maps.
              </h1>

              <p className="text-base leading-relaxed max-w-xl" style={{ color: 'var(--mw-muted)' }}>
                Combine up to 5 sources in one spatial workspace. Trace every concept back to its
                exact PDF page or video timestamp, detect blind spots, and test recall directly on
                the canvas.
              </p>

              <MultiSourceTray isWeaving={isWeaving} onWeave={weaveNewWorkspace} />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void loadDemoWorkspace()}
                  className="h-11 px-4 rounded-lg border text-sm font-medium inline-flex items-center gap-2 transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--mw-card)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-ink)',
                  }}
                >
                  <Play className="w-3.5 h-3.5" style={{ color: 'var(--mw-primary)' }} />
                  Open Interactive Flagship Demo
                </button>
                <span className="text-xs font-mono" style={{ color: 'var(--mw-muted)' }}>
                  Zero-login local IndexedDB · Works offline or with BYOK
                </span>
              </div>
            </div>

            {/* Right 6 columns: Hero Collage Frame showing real MindWeave UI */}
            <div className="lg:col-span-6">
              <div
                className="relative rounded-xl border p-5 sm:p-7 overflow-hidden"
                style={{
                  backgroundColor: 'var(--mw-putty)',
                  borderColor: 'var(--mw-border)',
                }}
              >
                {/* Live Window Mockup */}
                <div
                  className="rounded-xl border p-4 sm:p-5 space-y-4"
                  style={{
                    backgroundColor: 'var(--mw-bg)',
                    borderColor: 'var(--mw-border)',
                    boxShadow: 'var(--mw-shadow-lift)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b">
                    <span className="text-sm font-semibold truncate">
                      Transformer Architecture & Scaling Laws
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span
                        className="px-2 py-0.5 rounded border"
                        style={{
                          backgroundColor: 'var(--mw-card)',
                          borderColor: 'var(--mw-border)',
                        }}
                      >
                        Balanced ELK
                      </span>
                      <span
                        className="px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--mw-emerald-bg)',
                          color: 'var(--mw-emerald)',
                        }}
                      >
                        3 Sources
                      </span>
                    </div>
                  </div>

                  {/* Miniature Spatial Node Hierarchy */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className="rounded-xl p-3.5 border"
                      style={{
                        backgroundColor: 'var(--mw-primary)',
                        borderColor: 'var(--mw-primary)',
                        color: 'var(--mw-primary-ink)',
                      }}
                    >
                      <div className="font-mono text-[11px] opacity-80 mb-1">ROOT CONCEPT</div>
                      <div className="text-sm font-semibold">Scaled Dot-Product Attention</div>
                      <p className="text-xs opacity-90 mt-1 leading-snug">
                        Projects Q, K, V matrices and scales by 1/sqrt(d_k) before softmax.
                      </p>
                    </div>

                    <div
                      className="rounded-xl p-3.5 border space-y-2"
                      style={{
                        backgroundColor: 'var(--mw-card)',
                        borderColor: 'var(--mw-border)',
                      }}
                    >
                      <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'var(--mw-cite-bg)',
                            color: 'var(--mw-cite-ink)',
                          }}
                        >
                          Page 3 · Sec 3.2.1
                        </span>
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'var(--mw-cite-bg)',
                            color: 'var(--mw-cite-ink)',
                          }}
                        >
                          ▶ 04:12
                        </span>
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'var(--mw-emerald-bg)',
                            color: 'var(--mw-emerald)',
                          }}
                        >
                          Consensus
                        </span>
                      </div>
                      <div className="text-sm font-semibold">Variance Stabilization</div>
                      <p className="text-xs leading-snug" style={{ color: 'var(--mw-muted)' }}>
                        Keeps dot-product variance near 1 so backpropagation never stalls.
                      </p>
                    </div>
                  </div>

                  {/* Contradiction + Blind Spot Strip */}
                  <div
                    className="rounded-xl p-3 border flex flex-wrap items-center justify-between gap-2"
                    style={{
                      backgroundColor: 'var(--mw-card)',
                      borderColor: 'var(--mw-border)',
                    }}
                  >
                    <div className="text-xs">
                      <span className="font-semibold">Cross-Source Tension:</span>{' '}
                      <span style={{ color: 'var(--mw-muted)' }}>
                        Paper O(n²) matrix vs. FlashAttention SRAM tiling
                      </span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded font-mono text-[11px]"
                      style={{
                        backgroundColor: 'var(--mw-crimson-bg)',
                        color: 'var(--mw-crimson)',
                      }}
                    >
                      Contradiction
                    </span>
                  </div>
                </div>

                {/* Single Deal Overlay Card (Lower-Left) */}
                <div
                  className="mt-4 sm:mt-0 sm:relative sm:-mt-5 sm:ml-4 sm:w-72 rounded-xl border p-3.5"
                  style={{
                    backgroundColor: 'var(--mw-card)',
                    borderColor: 'var(--mw-border)',
                    boxShadow: 'var(--mw-shadow-lift)',
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span>Active Recall & Feynman Loop</span>
                    <span className="font-mono" style={{ color: 'var(--mw-emerald)' }}>
                      92 / 100
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] text-center">
                    <div
                      className="py-1 rounded"
                      style={{ backgroundColor: 'var(--mw-emerald-bg)', color: 'var(--mw-emerald)' }}
                    >
                      Mastered
                    </div>
                    <div
                      className="py-1 rounded"
                      style={{ backgroundColor: 'var(--mw-ochre-bg)', color: 'var(--mw-ochre)' }}
                    >
                      Partial
                    </div>
                    <div
                      className="py-1 rounded"
                      style={{ backgroundColor: 'var(--mw-crimson-bg)', color: 'var(--mw-crimson)' }}
                    >
                      Review
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Local Saved Library Section */}
        <section
          className="border-t py-10"
          style={{ borderColor: 'var(--mw-border)', backgroundColor: 'var(--mw-panel)' }}
        >
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Local Workspaces</h2>
                <p className="text-sm" style={{ color: 'var(--mw-muted)' }}>
                  Stored privately in your browser IndexedDB with portable JSON & Obsidian Canvas
                  exports.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="h-10 px-3.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--mw-card)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-ink)',
                  }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import .mindweave.json
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,.mindweave.json"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportJson(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {isInitializing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-36 rounded-xl border animate-pulse"
                    style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
                  />
                ))}
              </div>
            ) : savedWorkspaces.length === 0 ? (
              <div
                className="rounded-xl border p-8 text-center space-y-3"
                style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
              >
                <BookOpen className="w-8 h-8 mx-auto" style={{ color: 'var(--mw-primary)' }} />
                <h3 className="text-base font-semibold">No local workspaces yet</h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--mw-muted)' }}>
                  Weave a topic, YouTube lecture, or PDF above — or open the Interactive Flagship
                  Demo to explore multi-source citations, ELK layouts, and Feynman grading.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedWorkspaces.map((ws: MindMapWorkspace) => {
                  const nodeCount = flattenNodesOutline(ws.rootNode).length;
                  return (
                    <div key={ws.id} className="mw-card-interactive p-4 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {ws.sources.slice(0, 3).map((src) => (
                              <span
                                key={src.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px]"
                                style={{
                                  backgroundColor:
                                    src.type === 'youtube'
                                      ? 'var(--mw-crimson-bg)'
                                      : 'var(--mw-cite-bg)',
                                  color:
                                    src.type === 'youtube'
                                      ? 'var(--mw-crimson)'
                                      : 'var(--mw-cite-ink)',
                                }}
                              >
                                {src.type === 'youtube' ? (
                                  <Youtube className="w-3 h-3" />
                                ) : (
                                  <FileText className="w-3 h-3" />
                                )}
                                {src.type}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => void deleteSavedWorkspace(ws.id)}
                            className="p-1.5 rounded-md hover:opacity-75"
                            style={{ color: 'var(--mw-muted)' }}
                            aria-label={`Delete ${ws.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <h3 className="text-base font-semibold leading-snug line-clamp-2">
                          {ws.title}
                        </h3>
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--mw-muted)' }}>
                          {ws.subtitle}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                        <span
                          className="inline-flex items-center gap-1 font-mono"
                          style={{ color: 'var(--mw-muted)' }}
                        >
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(ws.updatedAt)} · {nodeCount} nodes
                        </span>
                        <button
                          type="button"
                          onClick={() => openSavedWorkspace(ws)}
                          className="h-8 px-3 rounded-md font-semibold text-xs"
                          style={{
                            backgroundColor: 'var(--mw-primary)',
                            color: 'var(--mw-primary-ink)',
                          }}
                        >
                          Open Studio
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
