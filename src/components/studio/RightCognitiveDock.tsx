'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Radar,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { CrossLinkRelation, NodeLensType } from '@/lib/schemas';
import {
  findNodeInTree,
  flattenNodesOutline,
  useWorkspaceStore,
} from '@/store/workspace-store';
import RichBlockRenderer from '@/components/canvas/RichBlockRenderer';

const LENS_BUTTONS: Array<{ type: NodeLensType; label: string }> = [
  { type: 'eli5', label: 'ELI5 Analogy' },
  { type: 'critic', label: 'Critic Lens' },
  { type: 'first_principles', label: 'First Principles' },
  { type: 'code_math', label: 'Code / Math / Flow' },
];

export default function RightCognitiveDock() {
  const {
    workspace,
    rightDrawerOpen,
    rightTab,
    selectedNodeId,
    chatMode,
    isChatLoading,
    isScanningBlindSpots,
    loadingLensKey,
    evaluatingNodeIds,
    setRightDrawer,
    setChatMode,
    updateNodeDetails,
    applyNodeLens,
    addCrossLink,
    removeCrossLink,
    detectBlindSpots,
    weaveBlindSpot,
    evaluateStudyAttempt,
    sendChatMessage,
    jumpToSourceAnchor,
  } = useWorkspaceStore();

  const [nodeDraft, setNodeDraft] = useState<{
    nodeId: string;
    topic: string;
    summary: string;
  } | null>(null);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelation, setLinkRelation] = useState<CrossLinkRelation>('supports');
  const [linkLabel, setLinkLabel] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const selectedMatch = useMemo(() => {
    if (!workspace) return null;
    const id = selectedNodeId || workspace.rootNode.id;
    return findNodeInTree(workspace.rootNode, id);
  }, [workspace, selectedNodeId]);

  const activeNode = selectedMatch?.node || workspace?.rootNode || null;

  const topicDraft =
    activeNode && nodeDraft?.nodeId === activeNode.id
      ? nodeDraft.topic
      : activeNode?.topic || '';
  const summaryDraft =
    activeNode && nodeDraft?.nodeId === activeNode.id
      ? nodeDraft.summary
      : activeNode?.summary || '';

  const outlineNodes = useMemo(() => {
    if (!workspace) return [];
    return flattenNodesOutline(workspace.rootNode);
  }, [workspace]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workspace?.chatMessages.length, isChatLoading]);

  if (!rightDrawerOpen || !workspace || !activeNode) return null;

  const otherNodes = outlineNodes.filter((n) => n.id !== activeNode.id);
  const isEvaluatingFeynman = evaluatingNodeIds.has(activeNode.id);

  const handleSaveNode = (e: React.FormEvent) => {
    e.preventDefault();
    updateNodeDetails(activeNode.id, topicDraft, summaryDraft);
  };

  const handleCreateCrossLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTargetId) return;
    addCrossLink(
      activeNode.id,
      linkTargetId,
      linkRelation,
      linkLabel || linkRelation.replace('_', ' '),
      `Connects "${activeNode.topic}" (${linkRelation}) to target branch.`
    );
    setLinkLabel('');
  };

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    if (chatMode === 'feynman') {
      await evaluateStudyAttempt(activeNode.id, 'feynman', text);
    } else {
      await sendChatMessage(text);
    }
  };

  const unresolvedBlindSpots = workspace.blindSpots.filter((b) => !b.resolved).length;

  return (
    <aside
      className="fixed lg:static inset-y-[52px] right-0 z-20 w-[380px] max-w-[92vw] border-l flex flex-col flex-shrink-0"
      style={{ backgroundColor: 'var(--mw-panel)', borderColor: 'var(--mw-border)' }}
      aria-label="Cognitive Inspector, Chat, and Blind Spots Dock"
    >
      {/* Dock Tabs */}
      <div
        className="p-2 border-b flex items-center justify-between gap-1"
        style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
      >
        <div className="grid grid-cols-3 gap-1 flex-1" role="tablist">
          {(
            [
              { id: 'inspector', label: 'Inspector', Icon: Layers },
              { id: 'chat', label: 'Chat & Study', Icon: MessageSquare },
              {
                id: 'blindspots',
                label: unresolvedBlindSpots > 0 ? `Gaps (${unresolvedBlindSpots})` : 'Blind Spots',
                Icon: Radar,
              },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = rightTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRightDrawer(true, id)}
                className="h-8 px-2 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1"
                style={{
                  backgroundColor: active ? 'var(--mw-primary-soft)' : 'transparent',
                  color: active ? 'var(--mw-primary)' : 'var(--mw-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setRightDrawer(false)}
          className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center"
          style={{ color: 'var(--mw-muted)' }}
          aria-label="Close right dock"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Inspector, 1-Click Lenses & Cross-Links */}
      {rightTab === 'inspector' && (
        <div className="flex-1 min-h-0 overflow-y-auto mw-scroll p-3 space-y-4">
          {/* Node Edit Form */}
          <form
            onSubmit={handleSaveNode}
            className="rounded-xl border p-3 space-y-2.5"
            style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--mw-muted)' }}>
                SELECTED NODE ({activeNode.id === 'root' ? 'ROOT' : `L${activeNode.level}`})
              </span>
              {activeNode.mastery !== 'untested' && (
                <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--mw-primary)' }}>
                  Mastery: {activeNode.masteryScore ?? '--'}%
                </span>
              )}
            </div>

            <input
              type="text"
              value={topicDraft}
              onChange={(e) =>
                setNodeDraft({
                  nodeId: activeNode.id,
                  topic: e.target.value,
                  summary: summaryDraft,
                })
              }
              aria-label="Node topic"
              className="w-full h-9 px-2.5 rounded-lg border text-sm font-semibold"
              style={{
                backgroundColor: 'var(--mw-bg)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            />
            <textarea
              value={summaryDraft}
              onChange={(e) =>
                setNodeDraft({
                  nodeId: activeNode.id,
                  topic: topicDraft,
                  summary: e.target.value,
                })
              }
              rows={3}
              aria-label="Node summary"
              className="w-full p-2.5 rounded-lg border text-xs leading-relaxed resize-y"
              style={{
                backgroundColor: 'var(--mw-bg)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="h-8 px-3 rounded-md text-xs font-semibold"
                style={{ backgroundColor: 'var(--mw-primary)', color: 'var(--mw-primary-ink)' }}
              >
                Update Node
              </button>
            </div>
          </form>

          {/* Grounded Citations */}
          {activeNode.anchors.length > 0 && (
            <div
              className="rounded-xl border p-3 space-y-2"
              style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
            >
              <h3 className="text-xs font-semibold">Source Citations</h3>
              <div className="space-y-2">
                {activeNode.anchors.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => jumpToSourceAnchor(a)}
                    className="w-full text-left rounded-lg border p-2.5 text-xs space-y-1 transition-colors hover:opacity-85"
                    style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: 'var(--mw-cite-ink)' }}>
                      {a.sourceType === 'youtube' ? (
                        <Play className="w-3 h-3 fill-current" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span>{a.label}</span>
                    </div>
                    <p className="line-clamp-2" style={{ color: 'var(--mw-muted)' }}>
                      “{a.excerpt}”
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1-Click Cognitive Lenses */}
          <div
            className="rounded-xl border p-3 space-y-2.5"
            style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold">Contextual AI Lenses</h3>
              <span className="text-[11px] font-mono" style={{ color: 'var(--mw-muted)' }}>
                1-Click Transform
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {LENS_BUTTONS.map((btn) => {
                const key = `${activeNode.id}:${btn.type}`;
                const loading = loadingLensKey === key;
                const applied = activeNode.lenses.some((l) => l.type === btn.type);
                return (
                  <button
                    key={btn.type}
                    type="button"
                    onClick={() => void applyNodeLens(activeNode.id, btn.type)}
                    disabled={loading}
                    className="h-9 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: applied ? 'var(--mw-primary-soft)' : 'var(--mw-bg)',
                      borderColor: applied ? 'var(--mw-primary)' : 'var(--mw-border)',
                      color: applied ? 'var(--mw-primary)' : 'var(--mw-ink)',
                    }}
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {activeNode.lenses.length > 0 && (
              <div className="space-y-2 pt-1">
                {activeNode.lenses.map((lens) => (
                  <RichBlockRenderer key={lens.id} lens={lens} />
                ))}
              </div>
            )}
          </div>

          {/* Semantic Cross-Links */}
          <div
            className="rounded-xl border p-3 space-y-2.5"
            style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          >
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" style={{ color: 'var(--mw-primary)' }} />
              <h3 className="text-xs font-semibold">Cross-Branch Semantic Links</h3>
            </div>

            <form onSubmit={handleCreateCrossLink} className="space-y-2">
              <select
                value={linkTargetId}
                onChange={(e) => setLinkTargetId(e.target.value)}
                aria-label="Target node for cross-link"
                className="w-full h-9 px-2 rounded-lg border text-xs"
                style={{
                  backgroundColor: 'var(--mw-bg)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              >
                <option value="">Connect &ldquo;{activeNode.topic}&rdquo; to...</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.topic}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={linkRelation}
                  onChange={(e) => setLinkRelation(e.target.value as CrossLinkRelation)}
                  aria-label="Cross-link relation"
                  className="h-9 px-2 rounded-lg border text-xs"
                  style={{
                    backgroundColor: 'var(--mw-bg)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-ink)',
                  }}
                >
                  <option value="supports">supports</option>
                  <option value="causes">causes</option>
                  <option value="depends_on">depends on</option>
                  <option value="contradicts">contradicts</option>
                  <option value="bridges">bridges</option>
                </select>

                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Edge label (optional)"
                  className="h-9 px-2 rounded-lg border text-xs"
                  style={{
                    backgroundColor: 'var(--mw-bg)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-ink)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!linkTargetId}
                className="w-full h-8 rounded-lg border text-xs font-semibold disabled:opacity-45"
                style={{
                  backgroundColor: 'var(--mw-bg)',
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-ink)',
                }}
              >
                Add Semantic Link
              </button>
            </form>

            {workspace.crossLinks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {workspace.crossLinks.map((xl) => (
                  <div
                    key={xl.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px]"
                    style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
                  >
                    <span className="truncate">
                      <strong className="font-mono">{xl.relation}</strong>: {xl.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCrossLink(xl.id)}
                      className="p-1 hover:opacity-75"
                      style={{ color: 'var(--mw-muted)' }}
                      aria-label={`Remove link ${xl.label}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Grounded Chat & Feynman "Explain It Back" Grader */}
      {rightTab === 'chat' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Ask vs Feynman Mode Switch */}
          <div className="p-2.5 border-b space-y-2" style={{ borderColor: 'var(--mw-border)' }}>
            <div
              className="grid grid-cols-2 gap-1 p-0.5 rounded-lg border"
              style={{ backgroundColor: 'var(--mw-bg)', borderColor: 'var(--mw-border)' }}
            >
              <button
                type="button"
                onClick={() => setChatMode('ask')}
                className="h-8 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1"
                style={{
                  backgroundColor: chatMode === 'ask' ? 'var(--mw-card)' : 'transparent',
                  color: chatMode === 'ask' ? 'var(--mw-ink)' : 'var(--mw-muted)',
                }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask Sources
              </button>
              <button
                type="button"
                onClick={() => setChatMode('feynman')}
                className="h-8 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1"
                style={{
                  backgroundColor: chatMode === 'feynman' ? 'var(--mw-primary)' : 'transparent',
                  color: chatMode === 'feynman' ? 'var(--mw-primary-ink)' : 'var(--mw-muted)',
                }}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Feynman Check
              </button>
            </div>
            <div className="text-[11px] font-mono truncate" style={{ color: 'var(--mw-muted)' }}>
              {chatMode === 'feynman'
                ? `Explain "${activeNode.topic}" in your own words to grade mastery`
                : `Focused on: ${activeNode.topic}`}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto mw-scroll p-3 space-y-3">
            {workspace.chatMessages.length === 0 ? (
              <div
                className="rounded-xl border p-4 text-xs space-y-2"
                style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
              >
                <p className="font-semibold">
                  {chatMode === 'feynman'
                    ? `Test your grasp of "${activeNode.topic}"`
                    : `Ask anything about "${activeNode.topic}"`}
                </p>
                <p style={{ color: 'var(--mw-muted)' }}>
                  {chatMode === 'feynman'
                    ? 'Teach the concept simply below. MindWeave scores completeness (0–100), highlights missed points, and updates your mastery badge.'
                    : 'Answers cite grounded PDF pages and YouTube timestamps from your woven sources.'}
                </p>
              </div>
            ) : (
              workspace.chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className="max-w-[92%] rounded-xl border px-3 py-2.5 text-xs leading-relaxed space-y-2"
                    style={{
                      backgroundColor:
                        msg.role === 'user' ? 'var(--mw-primary)' : 'var(--mw-card)',
                      borderColor:
                        msg.role === 'user' ? 'var(--mw-primary)' : 'var(--mw-border)',
                      color: msg.role === 'user' ? 'var(--mw-primary-ink)' : 'var(--mw-ink)',
                    }}
                  >
                    {msg.feynmanEvaluation && (
                      <div
                        className="rounded-lg px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between gap-2"
                        style={{
                          backgroundColor:
                            msg.feynmanEvaluation.mastery === 'mastered'
                              ? 'var(--mw-emerald-bg)'
                              : msg.feynmanEvaluation.mastery === 'partial'
                                ? 'var(--mw-ochre-bg)'
                                : 'var(--mw-crimson-bg)',
                          color:
                            msg.feynmanEvaluation.mastery === 'mastered'
                              ? 'var(--mw-emerald)'
                              : msg.feynmanEvaluation.mastery === 'partial'
                                ? 'var(--mw-ochre)'
                                : 'var(--mw-crimson)',
                        }}
                      >
                        <span>Feynman Score: {msg.feynmanEvaluation.score}/100</span>
                        <span className="uppercase">{msg.feynmanEvaluation.mastery}</span>
                      </div>
                    )}

                    <div className="prose prose-xs max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.feynmanEvaluation && msg.feynmanEvaluation.missedConcepts.length > 0 && (
                      <div className="pt-1 border-t text-[11px]" style={{ borderColor: 'var(--mw-border)' }}>
                        <span className="font-semibold">Missed: </span>
                        {msg.feynmanEvaluation.missedConcepts.join(', ')}
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {msg.citations.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => jumpToSourceAnchor(c)}
                            className="px-1.5 py-0.5 rounded font-mono text-[10px] border"
                            style={{
                              backgroundColor: 'var(--mw-cite-bg)',
                              color: 'var(--mw-cite-ink)',
                              borderColor: 'var(--mw-cite-border)',
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {(isChatLoading || isEvaluatingFeynman) && (
              <div
                className="rounded-xl border px-3 py-2.5 text-xs inline-flex items-center gap-2"
                style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--mw-primary)' }} />
                <span>
                  {isEvaluatingFeynman ? 'Evaluating Feynman explanation...' : 'Synthesizing answer...'}
                </span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmitChat}
            className="p-2.5 border-t flex gap-2"
            style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                chatMode === 'feynman'
                  ? `Explain "${activeNode.topic}" simply...`
                  : `Ask about "${activeNode.topic}"...`
              }
              disabled={isChatLoading || isEvaluatingFeynman}
              className="flex-1 h-10 px-3 rounded-lg border text-xs"
              style={{
                backgroundColor: 'var(--mw-bg)',
                borderColor: 'var(--mw-border)',
                color: 'var(--mw-ink)',
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading || isEvaluatingFeynman}
              className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-45"
              style={{
                backgroundColor: 'var(--mw-primary)',
                color: 'var(--mw-primary-ink)',
              }}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Blind Spots & Topology Gaps */}
      {rightTab === 'blindspots' && (
        <div className="flex-1 min-h-0 overflow-y-auto mw-scroll p-3 space-y-3">
          <div
            className="rounded-xl border p-3 flex items-center justify-between gap-2"
            style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
          >
            <div className="text-xs">
              <div className="font-semibold">Graph Gap Detector</div>
              <div style={{ color: 'var(--mw-muted)' }}>
                Finds missing perspectives & cross-branch links
              </div>
            </div>
            <button
              type="button"
              onClick={() => void detectBlindSpots()}
              disabled={isScanningBlindSpots}
              className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-55"
              style={{ backgroundColor: 'var(--mw-primary)', color: 'var(--mw-primary-ink)' }}
            >
              <Radar className={`w-3.5 h-3.5 ${isScanningBlindSpots ? 'animate-spin' : ''}`} />
              <span>Re-scan</span>
            </button>
          </div>

          {workspace.blindSpots.length === 0 ? (
            <div
              className="rounded-xl border p-6 text-center text-xs space-y-2"
              style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
            >
              <AlertTriangle className="w-6 h-6 mx-auto" style={{ color: 'var(--mw-ochre)' }} />
              <p className="font-semibold">No blind spots scanned yet</p>
              <p style={{ color: 'var(--mw-muted)' }}>
                Click Re-scan to detect unstated assumptions and structural gaps in this map.
              </p>
            </div>
          ) : (
            workspace.blindSpots.map((bs) => (
              <div
                key={bs.id}
                className="rounded-xl border p-3 space-y-2 text-xs"
                style={{ backgroundColor: 'var(--mw-card)', borderColor: 'var(--mw-border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[13px]">{bs.title}</span>
                  {bs.resolved && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px]"
                      style={{ backgroundColor: 'var(--mw-emerald-bg)', color: 'var(--mw-emerald)' }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Woven
                    </span>
                  )}
                </div>

                <p style={{ color: 'var(--mw-muted)' }}>{bs.missingPerspective}</p>
                <p className="text-[11px]" style={{ color: 'var(--mw-ink)' }}>
                  <strong>Why it matters:</strong> {bs.whyItMatters}
                </p>

                {!bs.resolved && (
                  <button
                    type="button"
                    onClick={() => weaveBlindSpot(bs.id)}
                    className="w-full h-8 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: 'var(--mw-primary-soft)',
                      borderColor: 'var(--mw-primary)',
                      color: 'var(--mw-primary)',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Weave &ldquo;{bs.suggestedTopic}&rdquo; into Map
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
