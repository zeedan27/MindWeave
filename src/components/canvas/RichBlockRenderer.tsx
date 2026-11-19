'use client';

import { useMemo, useState } from 'react';
import katex from 'katex';
import { Check, Copy } from 'lucide-react';
import type { NodeLensCard } from '@/lib/schemas';

interface RichBlockRendererProps {
  lens: NodeLensCard;
  compact?: boolean;
}

function parseFlowSteps(mermaidText: string): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  const labelMap = new Map<string, string>();
  const lines = mermaidText.split(/\r?\n/);

  const extractLabel = (token: string): { id: string; label: string } => {
    const match = token.trim().match(/^([a-zA-Z0-9_]+)\s*(?:\["?([^"\]]+)"?\])?$/);
    if (!match) return { id: token.trim(), label: token.trim() };
    const id = match[1];
    if (match[2]) labelMap.set(id, match[2].trim());
    return { id, label: labelMap.get(id) || id };
  };

  for (const line of lines) {
    const arrow = line.trim().match(/^(.+?)\s*-->\s*(.+)$/);
    if (!arrow) continue;
    const src = extractLabel(arrow[1]);
    const tgt = extractLabel(arrow[2]);
    edges.push({ from: src.label, to: tgt.label });
  }
  return edges.slice(0, 6);
}

export default function RichBlockRenderer({ lens, compact = false }: RichBlockRendererProps) {
  const [copied, setCopied] = useState(false);

  const katexHtml = useMemo(() => {
    if (!lens.mathLatex) return null;
    try {
      return katex.renderToString(lens.mathLatex, {
        throwOnError: false,
        displayMode: !compact,
        strict: false,
        trust: false,
      });
    } catch {
      return null;
    }
  }, [lens.mathLatex, compact]);

  const flowSteps = useMemo(() => {
    if (!lens.mermaidDiagram) return [];
    return parseFlowSteps(lens.mermaidDiagram);
  }, [lens.mermaidDiagram]);

  const copyCode = async () => {
    if (!lens.codeBlock?.code) return;
    await navigator.clipboard.writeText(lens.codeBlock.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="rounded-lg border p-3 space-y-2.5 text-xs"
      style={{
        backgroundColor: 'var(--mw-bg)',
        borderColor: 'var(--mw-border)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[13px]" style={{ color: 'var(--mw-ink)' }}>
          {lens.title}
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-mono text-[10px] uppercase"
          style={{
            backgroundColor: 'var(--mw-primary-soft)',
            color: 'var(--mw-primary)',
          }}
        >
          {lens.type.replace('_', ' ')}
        </span>
      </div>

      <p className="leading-relaxed" style={{ color: 'var(--mw-muted)' }}>
        {lens.summary}
      </p>

      {katexHtml && (
        <div
          className="rounded-md border px-2.5 py-2 overflow-x-auto"
          style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          dangerouslySetInnerHTML={{ __html: katexHtml }}
        />
      )}

      {!compact && lens.codeBlock && (
        <div
          className="rounded-md border overflow-hidden"
          style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
        >
          <div
            className="flex items-center justify-between px-2.5 py-1.5 border-b font-mono text-[10px]"
            style={{ backgroundColor: 'var(--mw-panel)', color: 'var(--mw-muted)' }}
          >
            <span>{lens.codeBlock.language}</span>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex items-center gap-1 hover:opacity-80"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-2.5 overflow-x-auto font-mono text-[11px] leading-relaxed">
            <code>{lens.codeBlock.code}</code>
          </pre>
        </div>
      )}

      {!compact && flowSteps.length > 0 && (
        <div
          className="rounded-md border p-2.5 space-y-1.5"
          style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
        >
          <div className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
            FLOW DIAGRAM
          </div>
          <div className="space-y-1">
            {flowSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                <span
                  className="px-2 py-0.5 rounded border"
                  style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
                >
                  {step.from}
                </span>
                <span style={{ color: 'var(--mw-primary)' }}>→</span>
                <span
                  className="px-2 py-0.5 rounded border"
                  style={{ backgroundColor: 'var(--mw-primary-soft)', borderColor: 'var(--mw-border)' }}
                >
                  {step.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
