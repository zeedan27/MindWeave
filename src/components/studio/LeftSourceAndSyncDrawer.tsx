'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Code2,
  FileText,
  GitBranch,
  Play,
  RefreshCw,
  Search,
  X,
  Youtube,
} from 'lucide-react';
import { formatTimestampSec } from '@/lib/demo-workspace';
import { extractYouTubeId } from '@/lib/ingestion/extractors';
import { workspaceToMarkdown, workspaceToMermaid } from '@/lib/sync/markdown-mermaid';
import { flattenNodesOutline, useWorkspaceStore } from '@/store/workspace-store';

export default function LeftSourceAndSyncDrawer() {
  const {
    workspace,
    leftDrawerOpen,
    leftTab,
    selectedNodeId,
    activeSourceJump,
    setLeftDrawer,
    selectNode,
    syncFromMarkdown,
    syncFromMermaid,
  } = useWorkspaceStore();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [ytSeekSec, setYtSeekSec] = useState<number>(0);
  const [outlineFilter, setOutlineFilter] = useState('');
  const [syncFormat, setSyncFormat] = useState<'markdown' | 'mermaid'>('markdown');
  const [editorText, setEditorText] = useState('');
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!workspace) return;
    if (!selectedSourceId || !workspace.sources.some((s) => s.id === selectedSourceId)) {
      setSelectedSourceId(workspace.sources[0]?.id || null);
    }
  }, [workspace, selectedSourceId]);

  // Respond to clicking a PDF Page or YouTube Timestamp pill on any canvas node
  useEffect(() => {
    if (!activeSourceJump) return;
    setSelectedSourceId(activeSourceJump.sourceId);
    if (activeSourceJump.timestampSec !== undefined) {
      setYtSeekSec(Math.floor(activeSourceJump.timestampSec));
    }
    if (activeSourceJump.segmentId) {
      setTimeout(() => {
        segmentRefs.current[activeSourceJump.segmentId!]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }, [activeSourceJump]);

  // Keep sync editor synchronized with workspace changes
  useEffect(() => {
    if (!workspace) return;
    if (syncFormat === 'markdown') {
      setEditorText(workspaceToMarkdown(workspace.rootNode));
    } else {
      setEditorText(workspaceToMermaid(workspace.rootNode, workspace.crossLinks));
    }
  }, [workspace, syncFormat]);

  const outlineItems = useMemo(() => {
    if (!workspace) return [];
    const items = flattenNodesOutline(workspace.rootNode);
    const q = outlineFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.topic.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)
    );
  }, [workspace, outlineFilter]);

  if (!leftDrawerOpen || !workspace) return null;

  const activeSource =
    workspace.sources.find((s) => s.id === selectedSourceId) || workspace.sources[0];
  const ytVideoId = activeSource?.url ? extractYouTubeId(activeSource.url) : null;

  const handleApplySync = () => {
    if (!editorText.trim()) return;
    if (syncFormat === 'markdown') {
      syncFromMarkdown(editorText);
    } else {
      syncFromMermaid(editorText);
    }
  };

  return (
    <aside
      className="fixed lg:static inset-y-[52px] left-0 z-20 w-[340px] max-w-[90vw] border-r flex flex-col flex-shrink-0"
      style={{ backgroundColor: 'var(--mw-panel)', borderColor: 'var(--mw-border)' }}
      aria-label="Sources, Outline, and Sync Drawer"
    >
      {/* Drawer Header Tabs */}
      <div
        className="p-2 border-b flex items-center justify-between gap-1"
        style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
      >
        <div className="grid grid-cols-3 gap-1 flex-1" role="tablist">
          {(
            [
              { id: 'sources', label: 'Sources', Icon: BookOpen },
              { id: 'outline', label: 'Outline', Icon: GitBranch },
              { id: 'sync', label: 'Live Sync', Icon: Code2 },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = leftTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLeftDrawer(true, id)}
                className="h-8 px-2 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1"
                style={{
                  backgroundColor: active ? 'var(--mw-primary-soft)' : 'transparent',
                  color: active ? 'var(--mw-primary)' : 'var(--mw-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLeftDrawer(false)}
          className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center"
          style={{ color: 'var(--mw-muted)' }}
          aria-label="Close left drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Sources & Citations Reader */}
      {leftTab === 'sources' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Source Selector Pills */}
          <div className="p-2.5 border-b flex flex-wrap gap-1.5" style={{ borderColor: 'var(--mw-border)' }}>
            {workspace.sources.map((src) => {
              const active = activeSource?.id === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => {
                    setSelectedSourceId(src.id);
                    setYtSeekSec(0);
                  }}
                  className="px-2.5 py-1 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 max-w-full"
                  style={{
                    backgroundColor: active ? 'var(--mw-card)' : 'var(--mw-bg)',
                    borderColor: active ? 'var(--mw-primary)' : 'var(--mw-border)',
                    color: active ? 'var(--mw-ink)' : 'var(--mw-muted)',
                  }}
                >
                  {src.type === 'youtube' ? (
                    <Youtube className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--mw-crimson)' }} />
                  ) : (
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--mw-cite-ink)' }} />
                  )}
                  <span className="truncate max-w-[190px]">{src.title}</span>
                </button>
              );
            })}
          </div>

          {/* Embedded Mini YouTube Player when YouTube source active */}
          {activeSource?.type === 'youtube' && ytVideoId && (
            <div className="p-2.5 border-b" style={{ borderColor: 'var(--mw-border)' }}>
              <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black">
                <iframe
                  key={`${ytVideoId}-${ytSeekSec}`}
                  src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?start=${ytSeekSec}&rel=0`}
                  title={activeSource.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--mw-muted)' }}>
                Synced at ▶ {formatTimestampSec(ytSeekSec)} · Click any segment below to seek
              </p>
            </div>
          )}

          {/* Source Segments List */}
          <div className="flex-1 min-h-0 overflow-y-auto mw-scroll p-2.5 space-y-2">
            {activeSource ? (
              activeSource.segments.map((seg) => {
                const isHighlighted = activeSourceJump?.segmentId === seg.id;
                const badge =
                  seg.startSec !== undefined
                    ? `▶ ${formatTimestampSec(seg.startSec)}`
                    : seg.pageNumber
                      ? `Page ${seg.pageNumber}`
                      : seg.heading || `Segment ${seg.index + 1}`;
                return (
                  <div
                    key={seg.id}
                    ref={(el) => {
                      segmentRefs.current[seg.id] = el;
                    }}
                    className="rounded-lg border p-2.5 text-xs space-y-1.5 transition-colors"
                    style={{
                      backgroundColor: isHighlighted ? 'var(--mw-cite-bg)' : 'var(--mw-card)',
                      borderColor: isHighlighted ? 'var(--mw-cite-ink)' : 'var(--mw-border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {seg.startSec !== undefined ? (
                        <button
                          type="button"
                          onClick={() => setYtSeekSec(seg.startSec || 0)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold"
                          style={{
                            backgroundColor: 'var(--mw-cite-bg)',
                            color: 'var(--mw-cite-ink)',
                          }}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          {badge}
                        </button>
                      ) : (
                        <span
                          className="px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold"
                          style={{
                            backgroundColor: 'var(--mw-bg)',
                            color: 'var(--mw-cite-ink)',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                      {seg.heading && seg.pageNumber && (
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--mw-muted)' }}>
                          {seg.heading}
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed" style={{ color: 'var(--mw-ink)' }}>
                      {seg.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs p-4 text-center" style={{ color: 'var(--mw-muted)' }}>
                No source segments available for this workspace.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Accessible Outline Tree */}
      {leftTab === 'outline' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2.5 border-b" style={{ borderColor: 'var(--mw-border)' }}>
            <div className="relative flex items-center">
              <Search
                className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none"
                style={{ color: 'var(--mw-muted)' }}
              />
              <input
                type="search"
                value={outlineFilter}
                onChange={(e) => setOutlineFilter(e.target.value)}
                placeholder="Filter nodes by topic..."
                aria-label="Filter outline tree"
                className="w-full h-9 pl-8 pr-2.5 rounded-lg border text-xs"
                style={{
                  backgroundColor: 'var(--mw-card)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              />
            </div>
          </div>

          <ul className="flex-1 min-h-0 overflow-y-auto mw-scroll p-2 space-y-1" role="tree">
            {outlineItems.map((item) => {
              const selected = selectedNodeId === item.id;
              const dotColor =
                item.mastery === 'mastered'
                  ? 'var(--mw-emerald)'
                  : item.mastery === 'partial'
                    ? 'var(--mw-ochre)'
                    : item.mastery === 'needs_review'
                      ? 'var(--mw-crimson)'
                      : 'var(--mw-border)';
              return (
                <li key={item.id} role="treeitem" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => selectNode(item.id)}
                    className="w-full text-left px-2.5 py-2 rounded-lg border text-xs flex items-center gap-2 transition-colors"
                    style={{
                      paddingLeft: `${10 + item.level * 14}px`,
                      backgroundColor: selected ? 'var(--mw-card)' : 'transparent',
                      borderColor: selected ? 'var(--mw-primary)' : 'transparent',
                      color: 'var(--mw-ink)',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="truncate font-medium">{item.topic}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Tab 3: Bi-Directional Markdown & Mermaid Live Sync */}
      {leftTab === 'sync' && (
        <div className="flex-1 min-h-0 flex flex-col p-2.5 gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex p-0.5 rounded-lg border"
              style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
            >
              <button
                type="button"
                onClick={() => setSyncFormat('markdown')}
                className="h-7 px-2.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: syncFormat === 'markdown' ? 'var(--mw-card)' : 'transparent',
                  color: syncFormat === 'markdown' ? 'var(--mw-ink)' : 'var(--mw-muted)',
                }}
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => setSyncFormat('mermaid')}
                className="h-7 px-2.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: syncFormat === 'mermaid' ? 'var(--mw-card)' : 'transparent',
                  color: syncFormat === 'mermaid' ? 'var(--mw-ink)' : 'var(--mw-muted)',
                }}
              >
                Mermaid
              </button>
            </div>

            <button
              type="button"
              onClick={handleApplySync}
              className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
              style={{
                backgroundColor: 'var(--mw-primary)',
                color: 'var(--mw-primary-ink)',
              }}
            >
              <RefreshCw className="w-3 h-3" />
              Apply to Canvas
            </button>
          </div>

          <textarea
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            aria-label={`Bi-directional ${syncFormat} editor`}
            className="flex-1 w-full p-3 rounded-lg border font-mono text-xs leading-relaxed resize-none mw-scroll"
            style={{
              backgroundColor: 'var(--mw-card)',
              borderColor: 'var(--mw-border)',
              color: 'var(--mw-ink)',
            }}
          />

          <p className="text-[11px]" style={{ color: 'var(--mw-muted)' }}>
            Edit headings/bullets or Mermaid edges and click <strong>Apply to Canvas</strong>.
            Existing citations, lenses, and mastery scores stay preserved.
          </p>
        </div>
      )}
    </aside>
  );
}
