'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { LayoutMode } from '@/lib/schemas';
import {
  flattenNodesOutline,
  StudyMode,
  useWorkspaceStore,
} from '@/store/workspace-store';

export default function WalkthroughAndStudyBar() {
  const {
    workspace,
    studyMode,
    walkthroughIndex,
    setWalkthroughIndex,
    setStudyMode,
    setLayoutMode,
    resetAllCloze,
  } = useWorkspaceStore();

  const [autoPlay, setAutoPlay] = useState(false);

  const masteryCounts = useMemo(() => {
    if (!workspace) return { mastered: 0, partial: 0, needs_review: 0, untested: 0 };
    const all = flattenNodesOutline(workspace.rootNode).filter((n) => n.level > 0);
    return all.reduce(
      (acc, n) => {
        acc[n.mastery] += 1;
        return acc;
      },
      { mastered: 0, partial: 0, needs_review: 0, untested: 0 }
    );
  }, [workspace]);

  useEffect(() => {
    if (!autoPlay || studyMode !== 'walkthrough' || !workspace) return;
    const total = workspace.walkthrough.length;
    if (total === 0) return;

    const timer = setInterval(() => {
      if (walkthroughIndex + 1 >= total) {
        setAutoPlay(false);
      } else {
        setWalkthroughIndex(walkthroughIndex + 1);
      }
    }, 5500);
    return () => clearInterval(timer);
  }, [autoPlay, studyMode, walkthroughIndex, workspace, setWalkthroughIndex]);

  if (!workspace) return null;

  if (studyMode === 'walkthrough' && workspace.walkthrough.length > 0) {
    const step = workspace.walkthrough[walkthroughIndex] || workspace.walkthrough[0];
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(560px,calc(100%-24px))] rounded-xl border p-3.5 space-y-2.5"
        style={{
          backgroundColor: 'var(--mw-card)',
          borderColor: 'var(--mw-primary)',
          boxShadow: 'var(--mw-shadow-lift)',
        }}
        role="region"
        aria-label="Guided Story Walkthrough"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--mw-primary)' }}>
            STEP {walkthroughIndex + 1} OF {workspace.walkthrough.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAutoPlay((p) => !p)}
              className="h-7 px-2.5 rounded-md border text-xs font-medium inline-flex items-center gap-1"
              style={{ borderColor: 'var(--mw-border)', backgroundColor: 'var(--mw-bg)' }}
            >
              {autoPlay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoPlay ? 'Pause' : 'Auto-Tour'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoPlay(false);
                setStudyMode('explore');
              }}
              className="h-7 px-2.5 rounded-md border text-xs font-medium"
              style={{ borderColor: 'var(--mw-border)' }}
            >
              Exit Tour
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{step.headline}</h3>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--mw-muted)' }}>
            {step.narrative}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setWalkthroughIndex(walkthroughIndex - 1)}
            disabled={walkthroughIndex === 0}
            className="h-8 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40"
            style={{ borderColor: 'var(--mw-border)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => setWalkthroughIndex(walkthroughIndex + 1)}
            disabled={walkthroughIndex >= workspace.walkthrough.length - 1}
            className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"
            style={{ backgroundColor: 'var(--mw-primary)', color: 'var(--mw-primary-ink)' }}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (studyMode === 'cloze') {
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(540px,calc(100%-24px))] rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
        style={{
          backgroundColor: 'var(--mw-card)',
          borderColor: 'var(--mw-primary)',
          boxShadow: 'var(--mw-shadow-lift)',
        }}
        role="region"
        aria-label="Active Recall Cloze Status"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
          <span
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--mw-emerald-bg)', color: 'var(--mw-emerald)' }}
          >
            Mastered: {masteryCounts.mastered}
          </span>
          <span
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--mw-ochre-bg)', color: 'var(--mw-ochre)' }}
          >
            Partial: {masteryCounts.partial}
          </span>
          <span
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--mw-crimson-bg)', color: 'var(--mw-crimson)' }}
          >
            Review: {masteryCounts.needs_review}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetAllCloze}
            className="h-7 px-2.5 rounded-md border text-xs font-medium inline-flex items-center gap-1"
            style={{ borderColor: 'var(--mw-border)', backgroundColor: 'var(--mw-bg)' }}
          >
            <RotateCcw className="w-3 h-3" />
            Mask Again
          </button>
          <button
            type="button"
            onClick={() => setStudyMode('explore')}
            className="h-7 px-2.5 rounded-md text-xs font-semibold"
            style={{ backgroundColor: 'var(--mw-primary)', color: 'var(--mw-primary-ink)' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="lg:hidden absolute bottom-3 left-3 right-3 z-10 rounded-xl border p-2 flex flex-wrap items-center justify-between gap-2"
      style={{
        backgroundColor: 'var(--mw-card)',
        borderColor: 'var(--mw-border)',
        boxShadow: 'var(--mw-shadow-lift)',
      }}
    >
      <select
        value={workspace.layoutMode}
        onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
        aria-label="Layout algorithm"
        className="h-8 px-2 rounded-md border text-xs"
        style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
      >
        <option value="balanced">Balanced</option>
        <option value="logic_tree">Logic Tree</option>
        <option value="radial">Radial</option>
        <option value="flowchart">Flowchart</option>
      </select>

      <select
        value={studyMode}
        onChange={(e) => setStudyMode(e.target.value as StudyMode)}
        aria-label="Study mode"
        className="h-8 px-2 rounded-md border text-xs"
        style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
      >
        <option value="explore">Explore</option>
        <option value="cloze">Active Recall</option>
        <option value="walkthrough">Walkthrough</option>
      </select>
    </div>
  );
}
