'use client';

import { create } from 'zustand';
import { createFlagshipDemoWorkspace } from '@/lib/demo-workspace';
import {
  BlindSpotInsight,
  ChatMessage,
  CrossLink,
  CrossLinkRelation,
  LayoutMode,
  MindMapNode,
  MindMapWorkspace,
  MindMapWorkspaceSchema,
  NodeLensCard,
  NodeLensType,
  NodeMasteryState,
  RuntimeAIConfig,
  SourceAnchor,
  SourceType,
} from '@/lib/schemas';
import {
  decodeWorkspaceHash,
  deleteWorkspaceFromStorage,
  encodeByokHeader,
  listSavedWorkspaces,
  loadByokConfig,
  saveByokConfig,
  saveWorkspaceToStorage,
} from '@/lib/storage/workspace-db';
import { markdownToRootNode, mermaidToRootNode } from '@/lib/sync/markdown-mermaid';

export type StudioView = 'launchpad' | 'studio';
export type StudyMode = 'explore' | 'cloze' | 'walkthrough';
export type LeftTab = 'sources' | 'outline' | 'sync';
export type RightTab = 'inspector' | 'chat' | 'blindspots';

export interface ActiveSourceJump {
  sourceId: string;
  segmentId?: string;
  pageNumber?: number;
  timestampSec?: number;
  nonce: number;
}

export interface StagedSourceItem {
  id: string;
  type: 'topic' | 'youtube' | 'file' | 'text';
  title: string;
  content: string;
  file?: File;
}

export function findNodeInTree(
  root: MindMapNode,
  nodeId: string,
  ancestors: string[] = [],
  parentChildren: MindMapNode[] = []
): { node: MindMapNode; ancestorTopics: string[]; siblingTopics: string[] } | null {
  if (root.id === nodeId) {
    return {
      node: root,
      ancestorTopics: ancestors,
      siblingTopics: parentChildren.filter((s) => s.id !== nodeId).map((s) => s.topic),
    };
  }
  for (const child of root.children) {
    const hit = findNodeInTree(child, nodeId, [...ancestors, root.topic], root.children);
    if (hit) return hit;
  }
  return null;
}

export function flattenNodesOutline(root: MindMapNode): Array<{
  id: string;
  parentId: string | null;
  topic: string;
  summary: string;
  level: number;
  mastery: NodeMasteryState;
}> {
  const out: Array<{
    id: string;
    parentId: string | null;
    topic: string;
    summary: string;
    level: number;
    mastery: NodeMasteryState;
  }> = [];
  function walk(node: MindMapNode) {
    out.push({
      id: node.id,
      parentId: node.parentId,
      topic: node.topic,
      summary: node.summary,
      level: node.level,
      mastery: node.mastery,
    });
    for (const c of node.children) walk(c);
  }
  walk(root);
  return out;
}

function updateNodeInTree(
  root: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    children: root.children.map((c) => updateNodeInTree(c, nodeId, updater)),
  };
}

function removeNodeFromTree(root: MindMapNode, nodeId: string): MindMapNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== nodeId)
      .map((c) => removeNodeFromTree(c, nodeId)),
  };
}

function isCompactViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

function buildApiHeaders(byok: RuntimeAIConfig, isJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  const encoded = encodeByokHeader(byok);
  if (encoded) headers['x-mindweave-ai-config'] = encoded;
  return headers;
}

interface WorkspaceState {
  view: StudioView;
  workspace: MindMapWorkspace | null;
  savedWorkspaces: MindMapWorkspace[];
  byokConfig: RuntimeAIConfig;
  serverAiReady: boolean;
  byokModalOpen: boolean;

  studyMode: StudyMode;
  walkthroughIndex: number;
  selectedNodeId: string | null;
  collapsedIds: Set<string>;
  revealedClozeIds: Set<string>;

  leftDrawerOpen: boolean;
  leftTab: LeftTab;
  rightDrawerOpen: boolean;
  rightTab: RightTab;
  chatMode: 'ask' | 'feynman';
  activeSourceJump: ActiveSourceJump | null;

  isInitializing: boolean;
  isWeaving: boolean;
  isScanningBlindSpots: boolean;
  isChatLoading: boolean;
  expandingNodeIds: Set<string>;
  loadingLensKey: string | null;
  evaluatingNodeIds: Set<string>;

  errorMessage: string | null;
  toastMessage: string | null;

  initStore: () => Promise<void>;
  setView: (view: StudioView) => void;
  setByokModalOpen: (open: boolean) => void;
  updateByokConfig: (config: RuntimeAIConfig) => void;
  dismissError: () => void;
  showToast: (msg: string | null) => void;

  loadDemoWorkspace: () => Promise<void>;
  openSavedWorkspace: (ws: MindMapWorkspace) => void;
  deleteSavedWorkspace: (id: string) => Promise<void>;
  importWorkspaceJson: (rawJson: string) => Promise<boolean>;

  weaveNewWorkspace: (items: StagedSourceItem[]) => Promise<void>;
  updateWorkspaceTitle: (title: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setStudyMode: (mode: StudyMode) => void;
  setWalkthroughIndex: (index: number) => void;

  setLeftDrawer: (open: boolean, tab?: LeftTab) => void;
  setRightDrawer: (open: boolean, tab?: RightTab) => void;
  setChatMode: (mode: 'ask' | 'feynman') => void;
  selectNode: (nodeId: string | null) => void;
  toggleCollapseNode: (nodeId: string) => void;
  revealClozeNode: (nodeId: string) => void;
  resetAllCloze: () => void;
  jumpToSourceAnchor: (anchor: SourceAnchor) => void;

  updateNodeDetails: (nodeId: string, topic: string, summary: string, detailedNotes?: string) => void;
  deleteNodeById: (nodeId: string) => void;
  addCrossLink: (
    sourceNodeId: string,
    targetNodeId: string,
    relation: CrossLinkRelation,
    label: string,
    rationale: string
  ) => void;
  removeCrossLink: (id: string) => void;

  expandNodeById: (nodeId: string) => Promise<void>;
  applyNodeLens: (nodeId: string, lensType: NodeLensType) => Promise<void>;
  detectBlindSpots: () => Promise<void>;
  weaveBlindSpot: (blindSpotId: string) => void;
  evaluateStudyAttempt: (nodeId: string, mode: 'cloze' | 'feynman', userAnswer: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;

  syncFromMarkdown: (markdown: string) => void;
  syncFromMermaid: (mermaid: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const persistCurrent = (ws: MindMapWorkspace) => {
    const stamped = { ...ws, updatedAt: Date.now() };
    set((state) => ({
      workspace: stamped,
      savedWorkspaces: [
        stamped,
        ...state.savedWorkspaces.filter((w) => w.id !== stamped.id),
      ],
    }));
    void saveWorkspaceToStorage(stamped);
  };

  return {
    view: 'launchpad',
    workspace: null,
    savedWorkspaces: [],
    byokConfig: { provider: 'openai', explicitlyConfigured: false },
    serverAiReady: false,
    byokModalOpen: false,

    studyMode: 'explore',
    walkthroughIndex: 0,
    selectedNodeId: null,
    collapsedIds: new Set<string>(),
    revealedClozeIds: new Set<string>(),

    leftDrawerOpen: true,
    leftTab: 'sources',
    rightDrawerOpen: true,
    rightTab: 'inspector',
    chatMode: 'ask',
    activeSourceJump: null,

    isInitializing: true,
    isWeaving: false,
    isScanningBlindSpots: false,
    isChatLoading: false,
    expandingNodeIds: new Set<string>(),
    loadingLensKey: null,
    evaluatingNodeIds: new Set<string>(),

    errorMessage: null,
    toastMessage: null,

    initStore: async () => {
      const byok = loadByokConfig();
      set({ byokConfig: byok });

      const saved = await listSavedWorkspaces();
      set({ savedWorkspaces: saved });

      if (typeof window !== 'undefined' && window.location.hash.startsWith('#mw=')) {
        const shared = decodeWorkspaceHash(window.location.hash);
        const compact = isCompactViewport();
        if (shared) {
          set({
            workspace: shared,
            view: 'studio',
            selectedNodeId: shared.rootNode.id,
            leftDrawerOpen: !compact,
            rightDrawerOpen: !compact,
            toastMessage: `Loaded shared workspace "${shared.title}"`,
          });
          await saveWorkspaceToStorage(shared);
        }
      }

      try {
        const res = await fetch('/api/healthz/ready', {
          headers: buildApiHeaders(byok, false),
        });
        if (res.ok) {
          const data = (await res.json()) as { aiServerConfigured?: boolean };
          set({ serverAiReady: Boolean(data.aiServerConfigured) });
        }
      } catch {
        // Offline ready check fallback
      } finally {
        set({ isInitializing: false });
      }
    },

    setView: (view) => set({ view }),
    setByokModalOpen: (open) => set({ byokModalOpen: open }),
    updateByokConfig: (config) => {
      saveByokConfig(config);
      set({
        byokConfig: config,
        serverAiReady: Boolean(
          config.apiKey || (config.provider === 'ollama' && config.explicitlyConfigured)
        ),
        toastMessage: `AI provider saved (${config.provider})`,
      });
    },
    dismissError: () => set({ errorMessage: null }),
    showToast: (msg) => set({ toastMessage: msg }),

    loadDemoWorkspace: async () => {
      const demo = createFlagshipDemoWorkspace();
      const compact = isCompactViewport();
      set({
        workspace: demo,
        view: 'studio',
        studyMode: 'explore',
        walkthroughIndex: 0,
        selectedNodeId: 'n_qkv',
        collapsedIds: new Set<string>(),
        revealedClozeIds: new Set<string>(),
        leftDrawerOpen: !compact,
        leftTab: 'sources',
        rightDrawerOpen: !compact,
        rightTab: 'inspector',
        errorMessage: null,
        toastMessage: 'Loaded Interactive Flagship Demo Workspace',
      });
      await saveWorkspaceToStorage(demo);
      const saved = await listSavedWorkspaces();
      set({ savedWorkspaces: saved });
    },

    openSavedWorkspace: (ws) => {
      const compact = isCompactViewport();
      set({
        workspace: ws,
        view: 'studio',
        studyMode: 'explore',
        walkthroughIndex: 0,
        selectedNodeId: ws.rootNode.id,
        collapsedIds: new Set<string>(),
        revealedClozeIds: new Set<string>(),
        leftDrawerOpen: !compact,
        rightDrawerOpen: !compact,
        errorMessage: null,
      });
    },

    deleteSavedWorkspace: async (id) => {
      await deleteWorkspaceFromStorage(id);
      set((state) => ({
        savedWorkspaces: state.savedWorkspaces.filter((w) => w.id !== id),
        toastMessage: 'Workspace removed from local library',
      }));
    },

    importWorkspaceJson: async (rawJson) => {
      try {
        const parsed = MindMapWorkspaceSchema.safeParse(JSON.parse(rawJson));
        if (!parsed.success) {
          set({ errorMessage: 'Invalid .mindweave.json workspace file format.' });
          return false;
        }
        await saveWorkspaceToStorage(parsed.data);
        const saved = await listSavedWorkspaces();
        const compact = isCompactViewport();
        set({
          workspace: parsed.data,
          savedWorkspaces: saved,
          view: 'studio',
          selectedNodeId: parsed.data.rootNode.id,
          leftDrawerOpen: !compact,
          rightDrawerOpen: !compact,
          toastMessage: `Imported "${parsed.data.title}"`,
        });
        return true;
      } catch {
        set({ errorMessage: 'Could not parse JSON workspace file.' });
        return false;
      }
    },

    weaveNewWorkspace: async (items) => {
      if (items.length === 0) return;
      set({ isWeaving: true, errorMessage: null });

      try {
        const { byokConfig } = get();
        const formData = new FormData();
        const meta: Array<{ type: SourceType; title?: string; content: string }> = [];

        for (const item of items) {
          if (item.type === 'file' && item.file) {
            formData.append('files', item.file);
          } else {
            meta.push({
              type: item.type === 'file' ? 'text' : item.type,
              title: item.title,
              content: item.content,
            });
          }
        }
        if (meta.length > 0) {
          formData.append('sourcesMeta', JSON.stringify(meta));
        }

        const res = await fetch('/api/weave', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig, false),
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          set({
            errorMessage: json?.error?.message || 'Failed to weave sources into workspace.',
          });
          return;
        }

        const ws = json.data.workspace as MindMapWorkspace;
        persistCurrent(ws);
        const compact = isCompactViewport();
        set({
          view: 'studio',
          studyMode: 'explore',
          walkthroughIndex: 0,
          selectedNodeId: ws.rootNode.id,
          collapsedIds: new Set<string>(),
          revealedClozeIds: new Set<string>(),
          leftDrawerOpen: !compact,
          leftTab: 'sources',
          rightDrawerOpen: !compact,
          rightTab: 'inspector',
          toastMessage: json.data.usedFallback
            ? 'Woven in offline grounded mode (configure an AI key for deep LLM synthesis)'
            : `Woven "${ws.title}" from ${ws.sources.length} source(s)`,
        });
      } catch {
        set({ errorMessage: 'Network error while weaving sources.' });
      } finally {
        set({ isWeaving: false });
      }
    },

    updateWorkspaceTitle: (title) => {
      const { workspace } = get();
      if (!workspace || !title.trim()) return;
      persistCurrent({ ...workspace, title: title.trim() });
    },

    setLayoutMode: (mode) => {
      const { workspace } = get();
      if (!workspace) return;
      persistCurrent({ ...workspace, layoutMode: mode });
    },

    setStudyMode: (mode) => {
      const { workspace } = get();
      const firstWalkId = workspace?.walkthrough[0]?.nodeId || workspace?.rootNode.id || null;
      set({
        studyMode: mode,
        walkthroughIndex: 0,
        revealedClozeIds: new Set<string>(),
        ...(mode === 'walkthrough' && firstWalkId ? { selectedNodeId: firstWalkId } : {}),
      });
    },

    setWalkthroughIndex: (index) => {
      const { workspace } = get();
      if (!workspace || workspace.walkthrough.length === 0) return;
      const bounded = Math.max(0, Math.min(index, workspace.walkthrough.length - 1));
      const targetId = workspace.walkthrough[bounded]?.nodeId || null;
      set({ walkthroughIndex: bounded, selectedNodeId: targetId });
    },

    setLeftDrawer: (open, tab) =>
      set((s) => ({
        leftDrawerOpen: open,
        leftTab: tab || s.leftTab,
        ...(open && isCompactViewport() ? { rightDrawerOpen: false } : {}),
      })),
    setRightDrawer: (open, tab) =>
      set((s) => ({
        rightDrawerOpen: open,
        rightTab: tab || s.rightTab,
        ...(open && isCompactViewport() ? { leftDrawerOpen: false } : {}),
      })),
    setChatMode: (mode) => set({ chatMode: mode }),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    toggleCollapseNode: (nodeId) =>
      set((state) => {
        const next = new Set(state.collapsedIds);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return { collapsedIds: next };
      }),

    revealClozeNode: (nodeId) =>
      set((state) => {
        const next = new Set(state.revealedClozeIds);
        next.add(nodeId);
        return { revealedClozeIds: next };
      }),

    resetAllCloze: () => set({ revealedClozeIds: new Set<string>() }),

    jumpToSourceAnchor: (anchor) =>
      set({
        leftDrawerOpen: true,
        leftTab: 'sources',
        ...(isCompactViewport() ? { rightDrawerOpen: false } : {}),
        activeSourceJump: {
          sourceId: anchor.sourceId,
          segmentId: anchor.segmentId,
          pageNumber: anchor.pageNumber,
          timestampSec: anchor.timestampSec,
          nonce: Date.now(),
        },
      }),

    updateNodeDetails: (nodeId, topic, summary, detailedNotes) => {
      const { workspace } = get();
      if (!workspace) return;
      const nextRoot = updateNodeInTree(workspace.rootNode, nodeId, (n) => ({
        ...n,
        topic: topic.trim() || n.topic,
        summary: summary.trim(),
        detailedNotes,
      }));
      persistCurrent({ ...workspace, rootNode: nextRoot });
    },

    deleteNodeById: (nodeId) => {
      const { workspace, selectedNodeId } = get();
      if (!workspace || nodeId === 'root') return;
      const nextRoot = removeNodeFromTree(workspace.rootNode, nodeId);
      const nextCross = workspace.crossLinks.filter(
        (xl) => xl.sourceNodeId !== nodeId && xl.targetNodeId !== nodeId
      );
      persistCurrent({ ...workspace, rootNode: nextRoot, crossLinks: nextCross });
      if (selectedNodeId === nodeId) set({ selectedNodeId: null });
    },

    addCrossLink: (sourceNodeId, targetNodeId, relation, label, rationale) => {
      const { workspace } = get();
      if (!workspace || sourceNodeId === targetNodeId) return;
      const newLink: CrossLink = {
        id: `xl_${Date.now().toString(36)}`,
        sourceNodeId,
        targetNodeId,
        relation,
        label: label.trim() || relation,
        rationale: rationale.trim() || 'User-defined conceptual link',
        isAiSuggested: false,
      };
      persistCurrent({ ...workspace, crossLinks: [...workspace.crossLinks, newLink] });
      set({ toastMessage: 'Cross-link added between branches' });
    },

    removeCrossLink: (id) => {
      const { workspace } = get();
      if (!workspace) return;
      persistCurrent({
        ...workspace,
        crossLinks: workspace.crossLinks.filter((xl) => xl.id !== id),
      });
    },

    expandNodeById: async (nodeId) => {
      const { workspace, byokConfig, expandingNodeIds, collapsedIds } = get();
      if (!workspace || expandingNodeIds.has(nodeId)) return;

      const found = findNodeInTree(workspace.rootNode, nodeId);
      if (!found) return;

      const nextExpanding = new Set(expandingNodeIds);
      nextExpanding.add(nodeId);
      set({ expandingNodeIds: nextExpanding });

      try {
        const allSegments = workspace.sources.flatMap((s) => s.segments);
        const res = await fetch('/api/expand', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig),
          body: JSON.stringify({
            workspaceTitle: workspace.title,
            node: { id: found.node.id, topic: found.node.topic, summary: found.node.summary },
            siblingTopics: found.siblingTopics,
            ancestorTopics: found.ancestorTopics,
            sourceSegments: allSegments.slice(0, 30),
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          set({ errorMessage: json?.error?.message || 'Node expansion failed.' });
          return;
        }

        const newChildren = (json.data.children as MindMapNode[]).map((c) => ({
          ...c,
          level: found.node.level + 1,
        }));

        const nextRoot = updateNodeInTree(workspace.rootNode, nodeId, (n) => ({
          ...n,
          children: [...n.children, ...newChildren],
        }));

        const nextCollapsed = new Set(collapsedIds);
        nextCollapsed.delete(nodeId);
        set({ collapsedIds: nextCollapsed });
        persistCurrent({ ...workspace, rootNode: nextRoot });
      } catch {
        set({ errorMessage: 'Network error expanding node.' });
      } finally {
        set((s) => {
          const copy = new Set(s.expandingNodeIds);
          copy.delete(nodeId);
          return { expandingNodeIds: copy };
        });
      }
    },

    applyNodeLens: async (nodeId, lensType) => {
      const { workspace, byokConfig } = get();
      if (!workspace) return;
      const found = findNodeInTree(workspace.rootNode, nodeId);
      if (!found) return;

      const lensKey = `${nodeId}:${lensType}`;
      set({ loadingLensKey: lensKey });

      try {
        const allSegments = workspace.sources.flatMap((s) => s.segments);
        const res = await fetch('/api/lens', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig),
          body: JSON.stringify({
            workspaceTitle: workspace.title,
            node: { id: found.node.id, topic: found.node.topic, summary: found.node.summary },
            lensType,
            sourceSegments: allSegments.slice(0, 20),
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          set({ errorMessage: json?.error?.message || 'Failed to apply lens.' });
          return;
        }

        const lensCard = json.data.lensCard as NodeLensCard;
        const nextRoot = updateNodeInTree(workspace.rootNode, nodeId, (n) => ({
          ...n,
          lenses: [lensCard, ...n.lenses.filter((l) => l.type !== lensType)],
        }));
        persistCurrent({ ...workspace, rootNode: nextRoot });
        set({ rightDrawerOpen: true, rightTab: 'inspector', selectedNodeId: nodeId });
      } catch {
        set({ errorMessage: 'Network error applying node lens.' });
      } finally {
        set({ loadingLensKey: null });
      }
    },

    detectBlindSpots: async () => {
      const { workspace, byokConfig } = get();
      if (!workspace) return;
      set({ isScanningBlindSpots: true });

      try {
        const outline = flattenNodesOutline(workspace.rootNode).map((n) => ({
          id: n.id,
          parentId: n.parentId,
          topic: n.topic,
          summary: n.summary,
        }));
        const sourceSummary = workspace.sources
          .map((s) => `${s.title}: ${s.segments.slice(0, 3).map((seg) => seg.text).join(' ')}`)
          .join('\n')
          .slice(0, 6000);

        const res = await fetch('/api/blindspots', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig),
          body: JSON.stringify({
            workspaceTitle: workspace.title,
            nodesOutline: outline,
            existingCrossLinks: workspace.crossLinks,
            sourceSummary,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          set({ errorMessage: json?.error?.message || 'Failed to scan blind spots.' });
          return;
        }

        const newInsights = json.data.blindSpots as BlindSpotInsight[];
        const newLinks = json.data.suggestedCrossLinks as CrossLink[];

        persistCurrent({
          ...workspace,
          blindSpots: newInsights,
          crossLinks: [...workspace.crossLinks, ...newLinks],
        });
        set({
          rightDrawerOpen: true,
          rightTab: 'blindspots',
          toastMessage: `Surfaced ${newInsights.length} structural blind spot(s)`,
        });
      } catch {
        set({ errorMessage: 'Network error scanning blind spots.' });
      } finally {
        set({ isScanningBlindSpots: false });
      }
    },

    weaveBlindSpot: (blindSpotId) => {
      const { workspace } = get();
      if (!workspace) return;
      const target = workspace.blindSpots.find((b) => b.id === blindSpotId);
      if (!target || target.resolved) return;

      const parentMatch = findNodeInTree(workspace.rootNode, target.suggestedParentNodeId);
      const parentId = parentMatch ? parentMatch.node.id : 'root';
      const parentLevel = parentMatch ? parentMatch.node.level : 0;

      const newNode: MindMapNode = {
        id: `bs_node_${Date.now().toString(36)}`,
        parentId,
        topic: target.suggestedTopic,
        summary: target.suggestedSummary,
        level: parentLevel + 1,
        children: [],
        anchors: [],
        lenses: [],
        mastery: 'untested',
      };

      const nextRoot = updateNodeInTree(workspace.rootNode, parentId, (n) => ({
        ...n,
        children: [...n.children, newNode],
      }));
      const nextBlindSpots = workspace.blindSpots.map((b) =>
        b.id === blindSpotId ? { ...b, resolved: true } : b
      );
      persistCurrent({ ...workspace, rootNode: nextRoot, blindSpots: nextBlindSpots });
      set({ selectedNodeId: newNode.id, toastMessage: `Wove "${newNode.topic}" into map` });
    },

    evaluateStudyAttempt: async (nodeId, mode, userAnswer) => {
      const { workspace, byokConfig, evaluatingNodeIds, revealedClozeIds } = get();
      if (!workspace || !userAnswer.trim()) return;
      const found = findNodeInTree(workspace.rootNode, nodeId);
      if (!found) return;

      const nextEval = new Set(evaluatingNodeIds);
      nextEval.add(nodeId);
      set({ evaluatingNodeIds: nextEval });

      if (mode === 'feynman') {
        const userMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'user',
          mode: 'feynman',
          content: userAnswer.trim(),
          nodeId,
          nodeTopic: found.node.topic,
          timestamp: Date.now(),
        };
        persistCurrent({
          ...workspace,
          chatMessages: [...workspace.chatMessages, userMsg],
        });
      }

      try {
        const allSegments = workspace.sources.flatMap((s) => s.segments);
        const res = await fetch('/api/study/evaluate', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig),
          body: JSON.stringify({
            mode,
            node: {
              id: found.node.id,
              topic: found.node.topic,
              summary: found.node.summary,
              childrenTopics: found.node.children.map((c) => c.topic),
            },
            userAnswer: userAnswer.trim(),
            sourceSegments: allSegments.slice(0, 20),
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          set({ errorMessage: json?.error?.message || 'Evaluation failed.' });
          return;
        }

        const { score, mastery, feedback, missedConcepts } = json.data as {
          score: number;
          mastery: NodeMasteryState;
          feedback: string;
          missedConcepts: string[];
        };

        const latestWs = get().workspace;
        if (!latestWs) return;

        const nextRoot = updateNodeInTree(latestWs.rootNode, nodeId, (n) => ({
          ...n,
          mastery,
          masteryScore: score,
          masteryFeedback: feedback,
        }));

        const nextRevealed = new Set(revealedClozeIds);
        if (mode === 'cloze') nextRevealed.add(nodeId);

        const extraMsgs: ChatMessage[] =
          mode === 'feynman'
            ? [
                {
                  id: `msg_${Date.now()}_feynman`,
                  role: 'assistant',
                  mode: 'feynman',
                  content: feedback,
                  nodeId,
                  nodeTopic: found.node.topic,
                  feynmanEvaluation: { score, mastery, missedConcepts },
                  timestamp: Date.now(),
                },
              ]
            : [];

        set({ revealedClozeIds: nextRevealed });
        persistCurrent({
          ...latestWs,
          rootNode: nextRoot,
          chatMessages: [...latestWs.chatMessages, ...extraMsgs],
        });
      } catch {
        set({ errorMessage: 'Network error grading study response.' });
      } finally {
        set((s) => {
          const copy = new Set(s.evaluatingNodeIds);
          copy.delete(nodeId);
          return { evaluatingNodeIds: copy };
        });
      }
    },

    sendChatMessage: async (message) => {
      const { workspace, byokConfig, selectedNodeId } = get();
      if (!workspace || !message.trim()) return;

      const found = selectedNodeId ? findNodeInTree(workspace.rootNode, selectedNodeId) : null;
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        mode: 'ask',
        content: message.trim(),
        nodeId: found?.node.id,
        nodeTopic: found?.node.topic,
        timestamp: Date.now(),
      };

      const history = workspace.chatMessages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      persistCurrent({
        ...workspace,
        chatMessages: [...workspace.chatMessages, userMsg],
      });
      set({ isChatLoading: true });

      try {
        const outline = flattenNodesOutline(workspace.rootNode).map((n) => ({
          id: n.id,
          topic: n.topic,
          summary: n.summary,
        }));
        const allSegments = workspace.sources.flatMap((s) => s.segments);

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: buildApiHeaders(byokConfig),
          body: JSON.stringify({
            message: message.trim(),
            history,
            workspaceTitle: workspace.title,
            nodesOutline: outline,
            selectedNode: found
              ? {
                  id: found.node.id,
                  topic: found.node.topic,
                  summary: found.node.summary,
                  childrenTopics: found.node.children.map((c) => c.topic),
                }
              : undefined,
            sourceSegments: allSegments.slice(0, 30),
          }),
        });

        const json = await res.json();
        const latestWs = get().workspace;
        if (!latestWs) return;

        if (!res.ok || !json.ok) {
          persistCurrent({
            ...latestWs,
            chatMessages: [
              ...latestWs.chatMessages,
              {
                id: `msg_${Date.now()}_err`,
                role: 'assistant',
                mode: 'ask',
                content: `Unable to answer: ${json?.error?.message || 'Request failed'}`,
                timestamp: Date.now(),
              },
            ],
          });
          return;
        }

        const aiMsg: ChatMessage = {
          id: `msg_${Date.now()}_ai`,
          role: 'assistant',
          mode: 'ask',
          content: json.data.reply,
          nodeId: found?.node.id,
          nodeTopic: found?.node.topic,
          citations: json.data.citations,
          timestamp: Date.now(),
        };

        persistCurrent({
          ...latestWs,
          chatMessages: [...latestWs.chatMessages, aiMsg],
        });
      } catch {
        const latestWs = get().workspace;
        if (latestWs) {
          persistCurrent({
            ...latestWs,
            chatMessages: [
              ...latestWs.chatMessages,
              {
                id: `msg_${Date.now()}_net`,
                role: 'assistant',
                mode: 'ask',
                content: 'Network error while reaching the assistant.',
                timestamp: Date.now(),
              },
            ],
          });
        }
      } finally {
        set({ isChatLoading: false });
      }
    },

    syncFromMarkdown: (markdown) => {
      const { workspace } = get();
      if (!workspace) return;
      const nextRoot = markdownToRootNode(markdown, workspace.rootNode);
      persistCurrent({ ...workspace, title: nextRoot.topic, rootNode: nextRoot });
      set({ toastMessage: 'Canvas synced from Markdown outline' });
    },

    syncFromMermaid: (mermaid) => {
      const { workspace } = get();
      if (!workspace) return;
      const nextRoot = mermaidToRootNode(mermaid, workspace.rootNode);
      persistCurrent({ ...workspace, title: nextRoot.topic, rootNode: nextRoot });
      set({ toastMessage: 'Canvas synced from Mermaid graph' });
    },
  };
});
