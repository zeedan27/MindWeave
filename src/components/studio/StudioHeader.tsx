'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  Download,
  Eye,
  GraduationCap,
  KeyRound,
  Moon,
  PanelLeft,
  PanelRight,
  Radar,
  Share2,
  Sun,
} from 'lucide-react';
import {
  downloadRetinaPng,
  downloadSvg,
  downloadTextFile,
  exportToAnkiCsv,
  exportToObsidianCanvas,
} from '@/lib/export/exporters';
import type { SpatialFlowEdge, SpatialFlowNode } from '@/lib/layout/spatial-engine';
import type { LayoutMode } from '@/lib/schemas';
import { encodeWorkspaceHash } from '@/lib/storage/workspace-db';
import { workspaceToMarkdown } from '@/lib/sync/markdown-mermaid';
import { StudyMode, useWorkspaceStore } from '@/store/workspace-store';

interface StudioHeaderProps {
  flowNodes: SpatialFlowNode[];
  flowEdges: SpatialFlowEdge[];
}

const LAYOUT_MODES: Array<{ id: LayoutMode; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'logic_tree', label: 'Logic Tree' },
  { id: 'radial', label: 'Radial' },
  { id: 'flowchart', label: 'Flowchart' },
];

const STUDY_MODES: Array<{ id: StudyMode; label: string; Icon: typeof Compass }> = [
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'cloze', label: 'Active Recall', Icon: Eye },
  { id: 'walkthrough', label: 'Walkthrough', Icon: GraduationCap },
];

export default function StudioHeader({ flowNodes, flowEdges }: StudioHeaderProps) {
  const {
    workspace,
    studyMode,
    leftDrawerOpen,
    rightDrawerOpen,
    isScanningBlindSpots,
    setView,
    updateWorkspaceTitle,
    setLayoutMode,
    setStudyMode,
    setLeftDrawer,
    setRightDrawer,
    setByokModalOpen,
    detectBlindSpots,
    showToast,
  } = useWorkspaceStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [exportOpen]);

  if (!workspace) return null;

  const toggleTheme = () => {
    const nextDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', nextDark);
    localStorage.setItem('mindweave_theme_v1', nextDark ? 'dark' : 'light');
  };

  const slug =
    workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || 'mindweave';

  const handleCopyShareLink = async () => {
    const hash = encodeWorkspaceHash(workspace);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    await navigator.clipboard.writeText(fullUrl).catch(() => {});
    setExportOpen(false);
    showToast('Copied compressed shareable snapshot URL to clipboard');
  };

  return (
    <header
      className="h-[52px] px-3 flex items-center justify-between gap-2 border-b flex-shrink-0 z-30"
      style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
    >
      {/* Left: Back, Editable Title, Source Count, Left Drawer Toggle */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setView('launchpad')}
          className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
          style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-ink)' }}
          aria-label="Back to launchpad"
          title="Back to Launchpad"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setLeftDrawer(!leftDrawerOpen)}
          className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
          style={{
            borderColor: 'var(--mw-border)',
            backgroundColor: leftDrawerOpen ? 'var(--mw-primary-soft)' : 'transparent',
            color: leftDrawerOpen ? 'var(--mw-primary)' : 'var(--mw-muted)',
          }}
          aria-label={leftDrawerOpen ? 'Close sources & sync drawer' : 'Open sources & sync drawer'}
          title="Toggle Sources, Outline & Markdown Sync"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {editingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              updateWorkspaceTitle(titleDraft);
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateWorkspaceTitle(titleDraft);
                setEditingTitle(false);
              }
            }}
            className="h-8 px-2 rounded-md border text-sm font-semibold w-52"
            style={{
              backgroundColor: 'var(--mw-bg)',
              borderColor: 'var(--mw-primary)',
              color: 'var(--mw-ink)',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(workspace.title);
              setEditingTitle(true);
            }}
            className="text-sm font-semibold truncate max-w-[160px] sm:max-w-[240px] text-left hover:underline"
            title="Click to rename workspace"
          >
            {workspace.title}
          </button>
        )}

        <span
          className="hidden md:inline-flex font-mono text-[11px] px-2 py-0.5 rounded border"
          style={{
            backgroundColor: 'var(--mw-bg)',
            borderColor: 'var(--mw-border)',
            color: 'var(--mw-muted)',
          }}
        >
          {workspace.sources.length} src
        </span>
      </div>

      {/* Center: Layout Mode & Study Mode Segmented Controls */}
      <div className="hidden lg:flex items-center gap-2">
        <div
          className="flex items-center p-0.5 rounded-lg border"
          style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
          role="group"
          aria-label="Spatial layout algorithm"
        >
          {LAYOUT_MODES.map((m) => {
            const active = workspace.layoutMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setLayoutMode(m.id)}
                className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--mw-card)' : 'transparent',
                  color: active ? 'var(--mw-ink)' : 'var(--mw-muted)',
                  border: active ? '1px solid var(--mw-border)' : '1px solid transparent',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center p-0.5 rounded-lg border"
          style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
          role="group"
          aria-label="Learning mode"
        >
          {STUDY_MODES.map(({ id, label, Icon }) => {
            const active = studyMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStudyMode(id)}
                className="h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors"
                style={{
                  backgroundColor: active ? 'var(--mw-primary)' : 'transparent',
                  color: active ? 'var(--mw-primary-ink)' : 'var(--mw-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Blind Spots, Export Menu, Settings, Theme, Right Dock Toggle */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void detectBlindSpots()}
          disabled={isScanningBlindSpots}
          className="h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-55"
          style={{
            backgroundColor: 'var(--mw-bg)',
            borderColor: 'var(--mw-border)',
            color: 'var(--mw-ink)',
          }}
          title="Analyze graph topology for structural blind spots"
        >
          <Radar className={`w-3.5 h-3.5 ${isScanningBlindSpots ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Blind Spots</span>
        </button>

        {/* Export Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            className="h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1"
            style={{
              backgroundColor: 'var(--mw-primary)',
              borderColor: 'var(--mw-primary)',
              color: 'var(--mw-primary-ink)',
            }}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {exportOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-60 rounded-xl border p-1.5 z-50 space-y-0.5"
              style={{
                backgroundColor: 'var(--mw-card)',
                borderColor: 'var(--mw-border)',
                boxShadow: 'var(--mw-shadow-lift)',
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadSvg(workspace, flowNodes, flowEdges);
                  setExportOpen(false);
                  showToast('Exported crisp SVG vector map');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
                style={{ backgroundColor: 'var(--mw-bg)' }}
              >
                <span>Vector Diagram (.svg)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  SVG
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void downloadRetinaPng(workspace, flowNodes, flowEdges).then(() => {
                    showToast('Exported 4x Retina PNG image');
                  });
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
              >
                <span>4x Retina Image (.png)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  PNG
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadTextFile(
                    `${slug}.md`,
                    workspaceToMarkdown(workspace.rootNode),
                    'text/markdown;charset=utf-8'
                  );
                  setExportOpen(false);
                  showToast('Exported Markdown outline');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
              >
                <span>Markdown Outline (.md)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  MD
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadTextFile(
                    `${slug}.canvas`,
                    exportToObsidianCanvas(workspace, flowNodes, flowEdges),
                    'application/json;charset=utf-8'
                  );
                  setExportOpen(false);
                  showToast('Exported Obsidian Canvas (.canvas)');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
              >
                <span>Obsidian Canvas (.canvas)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  JSON
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadTextFile(
                    `${slug}-anki.csv`,
                    exportToAnkiCsv(workspace),
                    'text/csv;charset=utf-8'
                  );
                  setExportOpen(false);
                  showToast('Exported Anki flashcard deck (.csv)');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
              >
                <span>Anki Flashcards (.csv)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  CSV
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadTextFile(
                    `${slug}.mindweave.json`,
                    JSON.stringify(workspace, null, 2),
                    'application/json;charset=utf-8'
                  );
                  setExportOpen(false);
                  showToast('Exported portable MindWeave workspace');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 flex items-center justify-between"
              >
                <span>Workspace Archive (.json)</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--mw-muted)' }}>
                  BACKUP
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyShareLink()}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium border-t mt-1 pt-2 flex items-center gap-2"
                style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-primary)' }}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Shareable Snapshot URL</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setByokModalOpen(true)}
          className="w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-muted)' }}
          aria-label="Configure AI provider settings"
          title="AI Key & Model Settings"
        >
          <KeyRound className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{ borderColor: 'var(--mw-border)', color: 'var(--mw-muted)' }}
          aria-label="Toggle color theme"
        >
          <Sun className="w-4 h-4 hidden dark:block" />
          <Moon className="w-4 h-4 block dark:hidden" />
        </button>

        <button
          type="button"
          onClick={() => setRightDrawer(!rightDrawerOpen)}
          className="w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{
            borderColor: 'var(--mw-border)',
            backgroundColor: rightDrawerOpen ? 'var(--mw-primary-soft)' : 'transparent',
            color: rightDrawerOpen ? 'var(--mw-primary)' : 'var(--mw-muted)',
          }}
          aria-label={rightDrawerOpen ? 'Close cognitive inspector dock' : 'Open cognitive inspector dock'}
          title="Toggle Node Inspector, Feynman Chat & Blind Spots"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
