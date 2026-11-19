'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ByokSettingsModal from '@/components/ByokSettingsModal';
import StudioLaunchpad from '@/components/StudioLaunchpad';
import LeftSourceAndSyncDrawer from '@/components/studio/LeftSourceAndSyncDrawer';
import RightCognitiveDock from '@/components/studio/RightCognitiveDock';
import StudioHeader from '@/components/studio/StudioHeader';
import WalkthroughAndStudyBar from '@/components/studio/WalkthroughAndStudyBar';
import type { SpatialFlowEdge, SpatialFlowNode } from '@/lib/layout/spatial-engine';
import { useWorkspaceStore } from '@/store/workspace-store';

const SpatialCanvas = dynamic(() => import('@/components/canvas/SpatialCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--mw-bg)' }}
      role="status"
      aria-label="Loading spatial canvas"
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 space-y-3 animate-pulse"
        style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
      >
        <div className="h-4 w-44 rounded" style={{ backgroundColor: 'var(--mw-panel)' }} />
        <div className="h-3 w-full rounded" style={{ backgroundColor: 'var(--mw-bg)' }} />
        <div className="h-3 w-4/5 rounded" style={{ backgroundColor: 'var(--mw-bg)' }} />
      </div>
    </div>
  ),
});

export default function HomePage() {
  const {
    view,
    workspace,
    errorMessage,
    toastMessage,
    initStore,
    dismissError,
    showToast,
  } = useWorkspaceStore();

  const [flowNodes, setFlowNodes] = useState<SpatialFlowNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<SpatialFlowEdge[]>([]);

  useEffect(() => {
    void initStore();
  }, [initStore]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => showToast(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage, showToast]);

  const handleLayoutReady = useCallback(
    (nodes: SpatialFlowNode[], edges: SpatialFlowEdge[]) => {
      setFlowNodes(nodes);
      setFlowEdges(edges);
    },
    []
  );

  return (
    <>
      {view === 'launchpad' || !workspace ? (
        <StudioLaunchpad />
      ) : (
        <div className="h-[100dvh] w-full flex flex-col overflow-hidden">
          <StudioHeader flowNodes={flowNodes} flowEdges={flowEdges} />

          {errorMessage && (
            <div
              className="px-4 py-2 border-b flex items-center justify-between gap-2 text-xs"
              style={{
                backgroundColor: 'var(--mw-crimson-bg)',
                borderColor: 'var(--mw-crimson)',
                color: 'var(--mw-crimson)',
              }}
              role="alert"
            >
              <span>{errorMessage}</span>
              <button type="button" onClick={dismissError} className="font-semibold underline">
                Dismiss
              </button>
            </div>
          )}

          <main id="main-workspace" className="flex-1 min-h-0 flex relative overflow-hidden">
            <LeftSourceAndSyncDrawer />

            <div className="flex-1 min-w-0 relative">
              <SpatialCanvas onLayoutReady={handleLayoutReady} />
              <WalkthroughAndStudyBar />
            </div>

            <RightCognitiveDock />
          </main>
        </div>
      )}

      <ByokSettingsModal />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)] z-50 px-4 py-2 rounded-xl border text-xs font-medium text-center"
          style={{
            backgroundColor: 'var(--mw-ink)',
            color: 'var(--mw-card)',
            borderColor: 'var(--mw-ink)',
            boxShadow: 'var(--mw-shadow-lift)',
          }}
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
