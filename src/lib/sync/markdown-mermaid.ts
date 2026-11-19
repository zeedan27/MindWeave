import type { CrossLink, MindMapNode } from '@/lib/schemas';

function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildExistingLookup(root: MindMapNode): Map<string, MindMapNode> {
  const map = new Map<string, MindMapNode>();
  function walk(node: MindMapNode) {
    map.set(normalizeTopicKey(node.topic), node);
    for (const child of node.children) walk(child);
  }
  walk(root);
  return map;
}

export function workspaceToMarkdown(rootNode: MindMapNode): string {
  const lines: string[] = [];
  lines.push(`# ${rootNode.topic}`);
  if (rootNode.summary) {
    lines.push(`> ${rootNode.summary}`);
  }
  lines.push('');

  function walk(node: MindMapNode, depth: number) {
    if (depth === 1) {
      lines.push(`## ${node.topic}`);
      if (node.summary) lines.push(`${node.summary}`);
      lines.push('');
    } else if (depth >= 2) {
      const indent = '  '.repeat(depth - 2);
      const summaryPart = node.summary ? `: ${node.summary}` : '';
      lines.push(`${indent}- **${node.topic}**${summaryPart}`);
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
    if (depth === 1) lines.push('');
  }

  for (const branch of rootNode.children) {
    walk(branch, 1);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function markdownToRootNode(markdown: string, existingRoot: MindMapNode): MindMapNode {
  const lookup = buildExistingLookup(existingRoot);
  const lines = markdown.split(/\r?\n/);

  let rootTopic = existingRoot.topic;
  let rootSummary = existingRoot.summary;

  const makeNode = (
    topic: string,
    summary: string,
    id: string,
    parentId: string | null,
    level: number
  ): MindMapNode => {
    const prev = lookup.get(normalizeTopicKey(topic));
    return {
      id: prev?.id || id,
      parentId,
      topic: topic.trim(),
      summary: summary.trim() || prev?.summary || '',
      detailedNotes: prev?.detailedNotes,
      level,
      children: [],
      anchors: prev?.anchors || [],
      lenses: prev?.lenses || [],
      mastery: prev?.mastery || 'untested',
      masteryScore: prev?.masteryScore,
      masteryFeedback: prev?.masteryFeedback,
    };
  };

  const rootChildren: MindMapNode[] = [];
  let currentBranch: MindMapNode | null = null;
  const bulletStack: Array<{ indent: number; node: MindMapNode }> = [];
  let autoSeq = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      rootTopic = trimmed.slice(2).trim() || rootTopic;
      continue;
    }

    if (trimmed.startsWith('> ') && rootChildren.length === 0 && !currentBranch) {
      rootSummary = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const topic = trimmed.slice(3).trim();
      if (!topic) continue;
      autoSeq += 1;
      currentBranch = makeNode(topic, '', `md_b_${autoSeq}`, 'root', 1);
      rootChildren.push(currentBranch);
      bulletStack.length = 0;
      continue;
    }

    const bulletMatch = rawLine.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const body = bulletMatch[2].trim();
      const boldSplit = body.match(/^\*\*(.+?)\*\*(?::\s*(.*))?$/);
      const colonSplit = body.match(/^([^:]{2,70}):\s+(.+)$/);

      const topic = boldSplit
        ? boldSplit[1]
        : colonSplit
          ? colonSplit[1]
          : body;
      const summary = boldSplit
        ? boldSplit[2] || ''
        : colonSplit
          ? colonSplit[2]
          : '';

      if (!currentBranch) {
        autoSeq += 1;
        currentBranch = makeNode(topic, summary, `md_b_${autoSeq}`, 'root', 1);
        rootChildren.push(currentBranch);
        bulletStack.length = 0;
        continue;
      }

      while (bulletStack.length > 0 && bulletStack[bulletStack.length - 1].indent >= indent) {
        bulletStack.pop();
      }
      const parent =
        bulletStack.length > 0
          ? bulletStack[bulletStack.length - 1].node
          : currentBranch;

      autoSeq += 1;
      const childNode = makeNode(topic, summary, `md_n_${autoSeq}`, parent.id, parent.level + 1);
      parent.children.push(childNode);
      bulletStack.push({ indent, node: childNode });
      continue;
    }

    if (currentBranch && !currentBranch.summary && !trimmed.startsWith('#')) {
      currentBranch.summary = trimmed;
    }
  }

  const rootPrev = lookup.get(normalizeTopicKey(rootTopic)) || existingRoot;
  return {
    ...rootPrev,
    id: 'root',
    parentId: null,
    topic: rootTopic,
    summary: rootSummary,
    level: 0,
    children: rootChildren.length > 0 ? rootChildren : existingRoot.children,
  };
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeMermaidLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
}

export function workspaceToMermaid(rootNode: MindMapNode, crossLinks: CrossLink[] = []): string {
  const lines: string[] = ['flowchart LR'];
  const idMap = new Map<string, string>();

  function declareWalk(node: MindMapNode) {
    const mId = sanitizeMermaidId(node.id);
    idMap.set(node.id, mId);
    lines.push(`  ${mId}["${escapeMermaidLabel(node.topic)}"]`);
    for (const child of node.children) {
      declareWalk(child);
    }
  }

  function edgeWalk(node: MindMapNode) {
    const parentMid = idMap.get(node.id);
    for (const child of node.children) {
      const childMid = idMap.get(child.id);
      if (parentMid && childMid) {
        lines.push(`  ${parentMid} --> ${childMid}`);
      }
      edgeWalk(child);
    }
  }

  declareWalk(rootNode);
  edgeWalk(rootNode);

  for (const xl of crossLinks) {
    const s = idMap.get(xl.sourceNodeId);
    const t = idMap.get(xl.targetNodeId);
    if (s && t) {
      lines.push(`  ${s} -. "${escapeMermaidLabel(xl.label)}" .-> ${t}`);
    }
  }

  return lines.join('\n') + '\n';
}

export function mermaidToRootNode(mermaidText: string, existingRoot: MindMapNode): MindMapNode {
  const lookup = buildExistingLookup(existingRoot);
  const labels = new Map<string, string>();
  const childrenLinks = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  const lines = mermaidText.split(/\r?\n/);

  const parseToken = (raw: string): { key: string; label?: string } => {
    const bracket = raw.trim().match(/^([a-zA-Z0-9_]+)\s*\["?(.+?)"?\]$/);
    if (bracket) {
      return { key: bracket[1], label: bracket[2].trim() };
    }
    const bare = raw.trim().match(/^([a-zA-Z0-9_]+)$/);
    return bare ? { key: bare[1] } : { key: '' };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('flowchart') || trimmed.startsWith('graph') || trimmed.startsWith('%%')) {
      continue;
    }

    const arrowMatch = trimmed.match(/^(.+?)\s*-->\s*(.+)$/);
    if (arrowMatch) {
      const src = parseToken(arrowMatch[1]);
      const tgt = parseToken(arrowMatch[2]);
      if (src.key && tgt.key) {
        if (src.label) labels.set(src.key, src.label);
        if (tgt.label) labels.set(tgt.key, tgt.label);
        const list = childrenLinks.get(src.key) || [];
        if (!list.includes(tgt.key)) list.push(tgt.key);
        childrenLinks.set(src.key, list);
        incomingCount.set(tgt.key, (incomingCount.get(tgt.key) || 0) + 1);
        if (!incomingCount.has(src.key)) incomingCount.set(src.key, 0);
      }
      continue;
    }

    const decl = parseToken(trimmed);
    if (decl.key && decl.label) {
      labels.set(decl.key, decl.label);
      if (!incomingCount.has(decl.key)) incomingCount.set(decl.key, 0);
    }
  }

  const rootKey =
    (labels.has('root') ? 'root' : undefined) ||
    Array.from(incomingCount.entries()).find(([, count]) => count === 0)?.[0];

  if (!rootKey) return existingRoot;

  const visited = new Set<string>();
  function buildNode(key: string, parentId: string | null, level: number): MindMapNode {
    visited.add(key);
    const topic = labels.get(key) || key;
    const prev = lookup.get(normalizeTopicKey(topic));
    const nodeId = level === 0 ? 'root' : prev?.id || `mm_${key}`;

    const childKeys = (childrenLinks.get(key) || []).filter((ck) => !visited.has(ck));
    return {
      id: nodeId,
      parentId,
      topic,
      summary: prev?.summary || '',
      detailedNotes: prev?.detailedNotes,
      level,
      anchors: prev?.anchors || [],
      lenses: prev?.lenses || [],
      mastery: prev?.mastery || 'untested',
      masteryScore: prev?.masteryScore,
      masteryFeedback: prev?.masteryFeedback,
      children: childKeys.map((ck) => buildNode(ck, nodeId, level + 1)),
    };
  }

  return buildNode(rootKey, null, 0);
}
