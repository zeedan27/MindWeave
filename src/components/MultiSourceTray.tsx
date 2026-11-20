'use client';

import { useCallback, useRef, useState } from 'react';
import {
  FileText,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
  Youtube,
} from 'lucide-react';
import type { StagedSourceItem } from '@/store/workspace-store';

type InputTab = 'topic' | 'youtube' | 'document' | 'notes';

interface MultiSourceTrayProps {
  isWeaving: boolean;
  onWeave: (items: StagedSourceItem[]) => Promise<void>;
}

const MAX_SOURCES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const YT_ID_REGEX =
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})|^([a-zA-Z0-9_-]{11})$/;

export default function MultiSourceTray({ isWeaving, onWeave }: MultiSourceTrayProps) {
  const [activeTab, setActiveTab] = useState<InputTab>('topic');
  const [staged, setStaged] = useState<StagedSourceItem[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [notesTitle, setNotesTitle] = useState('');
  const [notesBody, setNotesBody] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addStagedItem = useCallback(
    (item: StagedSourceItem) => {
      if (staged.length >= MAX_SOURCES) {
        setLocalError(`Maximum ${MAX_SOURCES} sources can be woven together per workspace.`);
        return;
      }
      setLocalError(null);
      setStaged((prev) => (prev.length >= MAX_SOURCES ? prev : [...prev, item]));
    },
    [staged.length]
  );

  const handleStageTopic = () => {
    const clean = topicInput.trim();
    if (!clean) return;
    addStagedItem({
      id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'topic',
      title: clean.slice(0, 80),
      content: clean,
    });
    setTopicInput('');
  };

  const handleStageYouTube = () => {
    const clean = youtubeInput.trim();
    if (!clean) return;
    if (!YT_ID_REGEX.test(clean)) {
      setLocalError('Enter a valid YouTube watch, youtu.be, or shorts URL.');
      return;
    }
    addStagedItem({
      id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'youtube',
      title: 'YouTube Lecture',
      content: clean,
    });
    setYoutubeInput('');
  };

  const handleStageNotes = () => {
    const body = notesBody.trim();
    if (!body) return;
    addStagedItem({
      id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      title: notesTitle.trim() || 'Markdown Research Notes',
      content: body,
    });
    setNotesTitle('');
    setNotesBody('');
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || isWeaving) return;
    const accepted: StagedSourceItem[] = [];
    let nextError: string | null = null;
    let remaining = MAX_SOURCES - staged.length;

    for (const file of Array.from(files)) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (!['.pdf', '.txt', '.md'].includes(ext)) {
        nextError = `"${file.name}" is unsupported. Use PDF, TXT, or MD files.`;
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        nextError = `"${file.name}" exceeds the 20 MB limit.`;
        continue;
      }
      if (remaining <= 0) {
        nextError = `Maximum ${MAX_SOURCES} sources can be woven together per workspace.`;
        break;
      }
      remaining -= 1;
      accepted.push({
        id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'file',
        title: file.name,
        content: file.name,
        file,
      });
    }

    if (accepted.length > 0) {
      setStaged((prev) => [...prev, ...accepted].slice(0, MAX_SOURCES));
    }
    setLocalError(nextError);
  };

  const handleSubmit = async () => {
    if (isWeaving) return;

    // Allow immediate 1-step generation directly from the active input if tray is empty
    const itemsToWeave = [...staged];
    if (itemsToWeave.length === 0) {
      if (activeTab === 'topic' && topicInput.trim()) {
        itemsToWeave.push({
          id: `stg_direct_${Date.now()}`,
          type: 'topic',
          title: topicInput.trim().slice(0, 80),
          content: topicInput.trim(),
        });
      } else if (activeTab === 'youtube' && youtubeInput.trim()) {
        if (!YT_ID_REGEX.test(youtubeInput.trim())) {
          setLocalError('Enter a valid YouTube watch, youtu.be, or shorts URL.');
          return;
        }
        itemsToWeave.push({
          id: `stg_direct_${Date.now()}`,
          type: 'youtube',
          title: 'YouTube Video',
          content: youtubeInput.trim(),
        });
      } else if (activeTab === 'notes' && notesBody.trim()) {
        itemsToWeave.push({
          id: `stg_direct_${Date.now()}`,
          type: 'text',
          title: notesTitle.trim() || 'Study Notes',
          content: notesBody.trim(),
        });
      }
    }

    if (itemsToWeave.length === 0) {
      setLocalError('Add at least one topic, YouTube URL, PDF, or note to weave.');
      return;
    }

    setLocalError(null);
    await onWeave(itemsToWeave);
  };

  const loadPresetBundle = () => {
    setLocalError(null);
    setStaged([
      {
        id: 'preset_topic',
        type: 'topic',
        title: 'Distributed Consensus: Raft vs. Paxos',
        content: 'Compare Raft leader election and log replication with Multi-Paxos tradeoffs',
      },
      {
        id: 'preset_notes',
        type: 'text',
        title: 'Failure Model Notes',
        content:
          '# Network Partitions\nSplit-brain prevention relies on strict majority quorums (N/2 + 1) and randomized election timeouts.\n\n## Performance Tradeoffs\nRaft optimizes understandability with strong leadership while EPaxos eliminates leader bottlenecks across WANs.',
      },
    ]);
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3.5"
      style={{
        backgroundColor: 'var(--mw-card)',
        borderColor: 'var(--mw-border)',
      }}
    >
      {/* Mode Switcher */}
      <div
        className="grid grid-cols-4 gap-1 p-1 rounded-lg border"
        style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
        role="tablist"
        aria-label="Source input type"
      >
        {(
          [
            { id: 'topic', label: 'Topic', Icon: Lightbulb },
            { id: 'youtube', label: 'YouTube', Icon: Youtube },
            { id: 'document', label: 'PDF / Doc', Icon: FileText },
            { id: 'notes', label: 'Notes', Icon: Sparkles },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveTab(id);
                setLocalError(null);
              }}
              className="flex items-center justify-center gap-1.5 h-9 px-2 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--mw-card)' : 'transparent',
                color: active ? 'var(--mw-ink)' : 'var(--mw-muted)',
                border: active ? '1px solid var(--mw-border)' : '1px solid transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Topic Tab */}
      {activeTab === 'topic' && (
        <div className="flex gap-2">
          <label htmlFor="mw-topic-input" className="sr-only">
            Topic to map
          </label>
          <input
            id="mw-topic-input"
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (staged.length > 0) handleStageTopic();
                else void handleSubmit();
              }
            }}
            placeholder="e.g. Memory Hierarchy & CPU Cache Coherence"
            disabled={isWeaving}
            className="flex-1 h-11 px-3.5 rounded-lg border text-sm"
            style={{
              backgroundColor: 'var(--mw-card)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          />
          <button
            type="button"
            onClick={handleStageTopic}
            disabled={isWeaving || !topicInput.trim()}
            className="h-11 px-3 rounded-lg border text-xs font-medium flex items-center gap-1 disabled:opacity-45"
            style={{
              backgroundColor: 'var(--mw-bg)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
            title="Stage topic to weave with additional sources"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Source
          </button>
        </div>
      )}

      {/* YouTube Tab */}
      {activeTab === 'youtube' && (
        <div className="flex gap-2">
          <label htmlFor="mw-yt-input" className="sr-only">
            YouTube lecture URL
          </label>
          <input
            id="mw-yt-input"
            type="url"
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (staged.length > 0) handleStageYouTube();
                else void handleSubmit();
              }
            }}
            placeholder="Paste YouTube URL (extracts transcript & timestamp chapters)"
            disabled={isWeaving}
            className="flex-1 h-11 px-3.5 rounded-lg border text-sm font-mono"
            style={{
              backgroundColor: 'var(--mw-card)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          />
          <button
            type="button"
            onClick={handleStageYouTube}
            disabled={isWeaving || !youtubeInput.trim()}
            className="h-11 px-3 rounded-lg border text-xs font-medium flex items-center gap-1 disabled:opacity-45"
            style={{
              backgroundColor: 'var(--mw-bg)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Video
          </button>
        </div>
      )}

      {/* Document Upload Tab */}
      {activeTab === 'document' && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isWeaving) setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (isWeaving) return;
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => {
              if (!isWeaving) fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={isWeaving ? -1 : 0}
            aria-disabled={isWeaving}
            onKeyDown={(e) => {
              if (isWeaving) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
              isWeaving ? 'opacity-60 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{
              borderColor: dragActive ? 'var(--mw-primary)' : 'var(--mw-border)',
              backgroundColor: dragActive ? 'var(--mw-primary-soft)' : 'var(--mw-bg)',
            }}
          >
            <Upload className="w-5 h-5 mx-auto mb-1.5" style={{ color: 'var(--mw-primary)' }} />
            <p className="text-sm font-medium">Drop PDF, Markdown, or TXT papers (up to 20 MB)</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mw-muted)' }}>
              Extracts exact page numbers so every map node links back to source excerpts.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md"
            multiple
            disabled={isWeaving}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-2">
          <input
            type="text"
            value={notesTitle}
            onChange={(e) => setNotesTitle(e.target.value)}
            placeholder="Note title (optional)"
            className="w-full h-9 px-3 rounded-lg border text-xs"
            style={{
              backgroundColor: 'var(--mw-card)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          />
          <textarea
            value={notesBody}
            onChange={(e) => setNotesBody(e.target.value)}
            rows={3}
            placeholder="Paste lecture notes, Markdown outline, or paper excerpts..."
            className="w-full p-3 rounded-lg border text-xs font-mono resize-y"
            style={{
              backgroundColor: 'var(--mw-card)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleStageNotes}
              disabled={!notesBody.trim()}
              className="h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1 disabled:opacity-45"
              style={{
                backgroundColor: 'var(--mw-bg)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Stage Note Source
            </button>
          </div>
        </div>
      )}

      {/* Staged Sources Queue */}
      {staged.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--mw-muted)' }}>
            <span>
              Multi-Source Synthesis Tray ({staged.length}/{MAX_SOURCES})
            </span>
            <button
              type="button"
              onClick={() => setStaged([])}
              className="underline hover:opacity-80"
            >
              Clear tray
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {staged.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono"
                style={{
                  backgroundColor: 'var(--mw-bg)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              >
                <span className="uppercase text-[10px] font-semibold" style={{ color: 'var(--mw-primary)' }}>
                  {item.type}
                </span>
                <span className="max-w-[180px] truncate">{item.title}</span>
                <button
                  type="button"
                  onClick={() => setStaged((s) => s.filter((x) => x.id !== item.id))}
                  aria-label={`Remove ${item.title}`}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {localError && (
        <p className="text-xs font-medium" style={{ color: 'var(--mw-crimson)' }} role="alert">
          {localError}
        </p>
      )}

      {/* Primary Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={loadPresetBundle}
          className="text-xs font-medium underline underline-offset-2 hover:opacity-80"
          style={{ color: 'var(--mw-muted)' }}
        >
          Stage sample multi-source bundle
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isWeaving}
          className="h-11 px-5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-60"
          style={{
            backgroundColor: 'var(--mw-primary)',
            color: 'var(--mw-primary-ink)',
          }}
        >
          {isWeaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Weaving {staged.length || 1} source(s)...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {staged.length > 1 ? `Weave ${staged.length} Sources` : 'Weave Knowledge Map'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
