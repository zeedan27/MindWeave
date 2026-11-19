'use client';

import { useEffect } from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('MindWeave fatal boundary:', error.message);
  }, [error]);

  const handleEmergencyBackup = () => {
    try {
      const raw = window.localStorage.getItem('mindweave_workspaces_v1') || '[]';
      const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindweave-emergency-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Best-effort browser backup
    }
  };

  return (
    <main
      id="main-workspace"
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--mw-bg)', color: 'var(--mw-ink)' }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6 space-y-4"
        style={{
          backgroundColor: 'var(--mw-card)',
          borderColor: 'var(--mw-crimson)',
          boxShadow: 'var(--mw-shadow-lift)',
        }}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: 'var(--mw-crimson-bg)',
              borderColor: 'var(--mw-crimson)',
              color: 'var(--mw-crimson)',
            }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Studio encountered an unexpected fault
            </h1>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--mw-muted)' }}>
              Your local IndexedDB & browser workspaces remain intact. Retry rendering or download
              a JSON backup of your saved maps.
            </p>
          </div>
        </div>

        <div
          className="rounded-lg border p-3 font-mono text-xs break-words"
          style={{
            backgroundColor: 'var(--mw-bg)',
            borderColor: 'var(--mw-border)',
            color: 'var(--mw-crimson)',
          }}
        >
          {error.message || 'Unhandled client rendering error.'}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleEmergencyBackup}
            className="h-10 px-3.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"
            style={{
              backgroundColor: 'var(--mw-bg)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Backup Local Maps (.json)
          </button>

          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            style={{
              backgroundColor: 'var(--mw-primary)',
              color: 'var(--mw-primary-ink)',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Workspace
          </button>
        </div>
      </div>
    </main>
  );
}
