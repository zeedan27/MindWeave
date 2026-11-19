import crypto from 'node:crypto';
import type {
  AgreementStatus,
  BlindSpotInsight,
  CrossLink,
  MindMapNode,
  MindMapWorkspace,
  SourceAnchor,
  SourceDocument,
  WalkthroughStep,
} from '@/lib/schemas';

export function formatTimestampSec(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createFlagshipDemoWorkspace(): MindMapWorkspace {
  const now = 1763596800000;

  const pdfSourceId = 'src_demo_pdf';
  const ytSourceId = 'src_demo_yt';
  const notesSourceId = 'src_demo_notes';

  const sources: SourceDocument[] = [
    {
      id: pdfSourceId,
      type: 'pdf',
      title: 'Attention Is All You Need & Scaling Laws (Paper Excerpt)',
      originLabel: 'vaswani-2017-annotated.pdf',
      fileName: 'vaswani-2017-annotated.pdf',
      rawTextHash: 'a91f40d9b6e0425c914d12ab88f9e0a1',
      createdAt: now,
      segments: [
        {
          id: `${pdfSourceId}-seg-0`,
          sourceId: pdfSourceId,
          index: 0,
          pageNumber: 1,
          heading: 'Abstract & Core Thesis',
          text: 'The Transformer dispenses with recurrence and convolutions entirely, relying solely on self-attention mechanisms to model global dependencies between input and output tokens in parallel.',
        },
        {
          id: `${pdfSourceId}-seg-1`,
          sourceId: pdfSourceId,
          index: 1,
          pageNumber: 3,
          heading: '3.2.1 Scaled Dot-Product Attention',
          text: 'We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain weights on the values. Scaling by 1/sqrt(d_k) prevents softmax gradients from vanishing for large dimensions.',
        },
        {
          id: `${pdfSourceId}-seg-2`,
          sourceId: pdfSourceId,
          index: 2,
          pageNumber: 4,
          heading: '3.2.2 Multi-Head Attention',
          text: 'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions simultaneously rather than averaging over a single head.',
        },
        {
          id: `${pdfSourceId}-seg-3`,
          sourceId: pdfSourceId,
          index: 3,
          pageNumber: 6,
          heading: '4. Complexity & Memory Tradeoffs',
          text: 'Self-attention connects all positions with O(1) sequential operations, while incurring O(n^2 * d) computational complexity with sequence length n compared to O(n * d^2) in recurrent layers.',
        },
      ],
    },
    {
      id: ytSourceId,
      type: 'youtube',
      title: 'Attention in Transformers, Visually Explained',
      originLabel: '3Blue1Brown · YouTube Lecture',
      url: 'https://www.youtube.com/watch?v=eMlx5fFNoYc',
      rawTextHash: 'b22c81a4e09172fa91cc33d085b7c1e2',
      createdAt: now,
      segments: [
        {
          id: `${ytSourceId}-seg-0`,
          sourceId: ytSourceId,
          index: 0,
          startSec: 252,
          endSec: 340,
          heading: 'Queries, Keys & Semantic Matching',
          text: 'Think of the Query vector as asking a question about context ("are there adjectives modifying this noun?") while each Key vector advertises what grammatical role a token holds.',
        },
        {
          id: `${ytSourceId}-seg-1`,
          sourceId: ytSourceId,
          index: 1,
          startSec: 695,
          endSec: 810,
          heading: 'Causal Masking & Autoregression',
          text: 'To keep training parallel without leaking future tokens, decoder attention sets upper-triangular entries to negative infinity before softmax so predictions depend only on earlier positions.',
        },
        {
          id: `${ytSourceId}-seg-2`,
          sourceId: ytSourceId,
          index: 2,
          startSec: 1120,
          endSec: 1260,
          heading: 'Softmax Sharpness & Temperature',
          text: 'Dividing by sqrt(d_k) keeps dot-product variance near 1; without it, high-dimensional embeddings saturate softmax into hard one-hot spikes that starve backpropagation.',
        },
      ],
    },
    {
      id: notesSourceId,
      type: 'text',
      title: 'Production Inference & KV-Cache Notes',
      originLabel: 'inference-benchmark-notes.md',
      fileName: 'inference-benchmark-notes.md',
      rawTextHash: 'c33e90f7d4b120e378889aa012ef9d34',
      createdAt: now,
      segments: [
        {
          id: `${notesSourceId}-seg-0`,
          sourceId: notesSourceId,
          index: 0,
          heading: 'Sub-Quadratic Inference Alternatives',
          text: 'While dense O(n^2) attention excels up to moderate contexts, FlashAttention tiles SRAM IO to avoid materializing the full N x N matrix in HBM, and state-space models challenge pure attention on 1M+ token streams.',
        },
      ],
    },
  ];

  const rootNode: MindMapNode = {
    id: 'root',
    parentId: null,
    topic: 'Transformer Architecture & Attention',
    summary:
      'Parallel sequence modeling built on scaled dot-product self-attention, multi-head subspaces, and hardware-aware scaling.',
    level: 0,
    mastery: 'untested',
    anchors: [
      {
        sourceId: pdfSourceId,
        segmentId: `${pdfSourceId}-seg-0`,
        sourceType: 'pdf',
        label: 'Page 1 · Abstract',
        excerpt:
          'The Transformer dispenses with recurrence and convolutions entirely, relying solely on self-attention mechanisms.',
        pageNumber: 1,
        agreement: 'consensus',
      },
    ],
    lenses: [
      {
        id: 'lens_demo_eli5',
        type: 'eli5',
        title: 'ELI5: Library Table of Cross-Referencing',
        summary:
          'Instead of reading a book one word at a time and forgetting the start (RNNs), every word in a room holds up a glowing card saying what it seeks (Query) and what it offers (Key) so relevant words connect instantly in one round.',
        createdAt: now,
      },
    ],
    children: [
      {
        id: 'n_qkv',
        parentId: 'root',
        topic: 'Scaled Dot-Product Attention',
        summary:
          'Projects token embeddings into Queries, Keys, and Values, dividing dot products by sqrt(d_k) before softmax normalization.',
        level: 1,
        mastery: 'mastered',
        masteryScore: 92,
        masteryFeedback: 'Accurate intuition on Query/Key alignment and variance stabilization.',
        anchors: [
          {
            sourceId: pdfSourceId,
            segmentId: `${pdfSourceId}-seg-1`,
            sourceType: 'pdf',
            label: 'Page 3 · Sec 3.2.1',
            excerpt:
              'Divide each by sqrt(d_k), and apply a softmax function to obtain weights on the values.',
            pageNumber: 3,
            agreement: 'consensus',
          },
          {
            sourceId: ytSourceId,
            segmentId: `${ytSourceId}-seg-0`,
            sourceType: 'youtube',
            label: '▶ 04:12',
            excerpt:
              'Think of the Query vector as asking a question about context while each Key vector advertises what grammatical role a token holds.',
            timestampSec: 252,
            agreement: 'consensus',
          },
        ],
        lenses: [
          {
            id: 'lens_demo_math',
            type: 'code_math',
            title: 'Formula & PyTorch Implementation',
            summary: 'Matrix formulation and scaled causal attention kernel.',
            mathLatex: String.raw`\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V`,
            codeBlock: {
              language: 'python',
              code: `def scaled_attention(q, k, v, mask=None):
    scores = (q @ k.transpose(-2, -1)) / (k.size(-1) ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    return torch.softmax(scores, dim=-1) @ v`,
            },
            createdAt: now,
          },
        ],
        children: [
          {
            id: 'n_variance',
            parentId: 'n_qkv',
            topic: 'Variance Scaling (1 / sqrt(d_k))',
            summary:
              'Prevents large dot-product magnitudes from pushing softmax into flat regions with near-zero gradients.',
            level: 2,
            mastery: 'untested',
            anchors: [
              {
                sourceId: ytSourceId,
                segmentId: `${ytSourceId}-seg-2`,
                sourceType: 'youtube',
                label: '▶ 18:40',
                excerpt:
                  'Dividing by sqrt(d_k) keeps dot-product variance near 1; without it, embeddings saturate softmax.',
                timestampSec: 1120,
                agreement: 'consensus',
              },
            ],
            lenses: [],
            children: [],
          },
          {
            id: 'n_causal_mask',
            parentId: 'n_qkv',
            topic: 'Autoregressive Causal Masking',
            summary:
              'Applies -infinity upper-triangular masking pre-softmax so future tokens receive zero probability weight.',
            level: 2,
            mastery: 'partial',
            masteryScore: 68,
            masteryFeedback: 'Remember that masking happens BEFORE softmax, not after normalization.',
            anchors: [
              {
                sourceId: ytSourceId,
                segmentId: `${ytSourceId}-seg-1`,
                sourceType: 'youtube',
                label: '▶ 11:35',
                excerpt:
                  'Decoder attention sets upper-triangular entries to negative infinity before softmax.',
                timestampSec: 695,
                agreement: 'unique',
              },
            ],
            lenses: [],
            children: [],
          },
        ],
      },
      {
        id: 'n_mha',
        parentId: 'root',
        topic: 'Multi-Head Subspaces',
        summary:
          'Splits embeddings into h parallel projection heads so syntax, coreference, and positional cues attend independently.',
        level: 1,
        mastery: 'untested',
        anchors: [
          {
            sourceId: pdfSourceId,
            segmentId: `${pdfSourceId}-seg-2`,
            sourceType: 'pdf',
            label: 'Page 4 · Sec 3.2.2',
            excerpt:
              'Multi-head attention allows the model to jointly attend to information from different representation subspaces.',
            pageNumber: 4,
            agreement: 'unique',
          },
        ],
        lenses: [],
        children: [
          {
            id: 'n_concat_proj',
            parentId: 'n_mha',
            topic: 'Head Concatenation & W_O',
            summary:
              'Merges independent head outputs back into d_model space through a learned output linear projection.',
            level: 2,
            mastery: 'untested',
            anchors: [],
            lenses: [],
            children: [],
          },
        ],
      },
      {
        id: 'n_complexity',
        parentId: 'root',
        topic: 'Quadratic Cost vs. IO Tiling',
        summary:
          'Dense self-attention scales O(n^2) with sequence length, creating HBM bandwidth bottlenecks mitigated by FlashAttention.',
        level: 1,
        mastery: 'needs_review',
        masteryScore: 45,
        masteryFeedback: 'Review why SRAM tiling reduces memory IO without changing mathematical output.',
        anchors: [
          {
            sourceId: pdfSourceId,
            segmentId: `${pdfSourceId}-seg-3`,
            sourceType: 'pdf',
            label: 'Page 6 · Sec 4',
            excerpt:
              'Incurring O(n^2 * d) computational complexity with sequence length n compared to O(n * d^2) in recurrent layers.',
            pageNumber: 6,
            agreement: 'contradiction',
          },
          {
            sourceId: notesSourceId,
            segmentId: `${notesSourceId}-seg-0`,
            sourceType: 'text',
            label: 'Inference Notes',
            excerpt:
              'FlashAttention tiles SRAM IO to avoid materializing the full N x N matrix in HBM, and state-space models challenge pure attention on 1M+ token streams.',
            agreement: 'contradiction',
          },
        ],
        lenses: [
          {
            id: 'lens_demo_critic',
            type: 'critic',
            title: 'Critic Lens: Context Length Bottleneck',
            summary:
              'The 2017 paper highlights O(1) sequential path length as strictly superior to RNNs, yet inference notes show KV-cache footprint and quadratic prefill force hybrid architectures (GQA, Ring Attention, Mamba) at 128k–1M contexts.',
            createdAt: now,
          },
        ],
        children: [
          {
            id: 'n_flash',
            parentId: 'n_complexity',
            topic: 'FlashAttention SRAM Tiling',
            summary:
              'Fuses softmax normalization blocks inside fast GPU on-chip SRAM to eliminate O(n^2) HBM reads/writes.',
            level: 2,
            mastery: 'untested',
            anchors: [
              {
                sourceId: notesSourceId,
                segmentId: `${notesSourceId}-seg-0`,
                sourceType: 'text',
                label: 'Inference Notes',
                excerpt: 'FlashAttention tiles SRAM IO to avoid materializing the full N x N matrix in HBM.',
                agreement: 'unique',
              },
            ],
            lenses: [],
            children: [],
          },
        ],
      },
    ],
  };

  const crossLinks: CrossLink[] = [
    {
      id: 'xl_1',
      sourceNodeId: 'n_variance',
      targetNodeId: 'n_mha',
      relation: 'supports',
      label: 'stabilizes heads',
      rationale: 'Each attention head operates on d_k = d_model / h, requiring scaled variance per head.',
      isAiSuggested: false,
    },
    {
      id: 'xl_2',
      sourceNodeId: 'n_causal_mask',
      targetNodeId: 'n_flash',
      relation: 'depends_on',
      label: 'skips masked blocks',
      rationale: 'Causal triangular sparsity allows FlashAttention kernels to skip half of all tile computations.',
      isAiSuggested: true,
    },
  ];

  const blindSpots: BlindSpotInsight[] = [
    {
      id: 'bs_1',
      title: 'Missing Positional Encoding Mechanics (RoPE vs. Sinusoidal)',
      missingPerspective:
        'Self-attention is permutation-equivariant; without Rotary Position Embeddings (RoPE) or ALiBi, token order and length extrapolation collapse.',
      whyItMatters:
        'Understanding positional injection explains how modern LLMs extend beyond training context lengths.',
      suggestedParentNodeId: 'root',
      suggestedTopic: 'Positional Encodings & RoPE',
      suggestedSummary:
        'Injects relative token order via complex rotation matrices on Queries and Keys before dot-product scoring.',
      resolved: false,
    },
    {
      id: 'bs_2',
      title: 'Unaddressed KV-Cache & Grouped-Query Attention (GQA)',
      missingPerspective:
        'Multi-head decoding bottlenecks on memory bandwidth loading past Keys and Values per generated token.',
      whyItMatters:
        'Bridges the gap between academic multi-head diagrams and real-world LLM serving latency.',
      suggestedParentNodeId: 'n_mha',
      suggestedTopic: 'KV-Cache & Grouped-Query Attention',
      suggestedSummary:
        'Shares Key/Value heads across query groups to shrink inference memory footprint up to 8x.',
      resolved: false,
    },
  ];

  const walkthrough: WalkthroughStep[] = [
    {
      stepIndex: 0,
      nodeId: 'root',
      headline: '1. Why Attention Replaced Recurrence',
      narrative:
        'Transformers eliminate sequential hidden-state bottlenecks so every token interacts directly in parallel.',
      durationSec: 6,
    },
    {
      stepIndex: 1,
      nodeId: 'n_qkv',
      headline: '2. Query-Key Matching & Scaling',
      narrative:
        'Queries probe context against Keys, stabilized by 1/sqrt(d_k) before softmax weights Values.',
      durationSec: 7,
    },
    {
      stepIndex: 2,
      nodeId: 'n_mha',
      headline: '3. Parallel Subspace Specialization',
      narrative:
        'Multiple heads track syntax, semantics, and long-range links simultaneously before W_O merges them.',
      durationSec: 6,
    },
    {
      stepIndex: 3,
      nodeId: 'n_complexity',
      headline: '4. From Quadratic Cost to Hardware Tiling',
      narrative:
        'Notice the tension between the original O(n^2) complexity analysis and modern SRAM-tiled FlashAttention.',
      durationSec: 7,
    },
  ];

  return {
    id: 'ws_flagship_demo',
    schemaVersion: 1,
    title: 'Transformer Architecture & Scaling Laws',
    subtitle: 'Interactive Flagship Sample · 3 Woven Sources (PDF + YouTube + Notes)',
    layoutMode: 'balanced',
    sources,
    rootNode,
    crossLinks,
    blindSpots,
    walkthrough,
    chatMessages: [
      {
        id: 'msg_demo_1',
        role: 'assistant',
        mode: 'ask',
        content:
          'Welcome to the **Transformer Architecture & Scaling Laws** interactive workspace. Click any `Page` pill to inspect the exact PDF excerpt, click `▶ 04:12` to jump the video player, or switch to **Active Recall** mode to test your memory.',
        citations: [
          {
            sourceId: pdfSourceId,
            segmentId: `${pdfSourceId}-seg-1`,
            sourceType: 'pdf',
            label: 'Page 3 · Sec 3.2.1',
            excerpt: 'Divide each by sqrt(d_k), and apply a softmax function.',
            pageNumber: 3,
            agreement: 'consensus',
          },
        ],
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Deterministic offline synthesizer used when no live AI key is configured,
 * ensuring custom Topics, PDFs, Markdown notes, and YouTube videos still produce grounded maps.
 */
export function buildDeterministicWorkspaceFromSources(
  sources: SourceDocument[]
): MindMapWorkspace {
  const now = Date.now();
  const primary = sources[0];
  const rootTitle =
    sources.length === 1
      ? primary.title
      : `${primary.title} (+${sources.length - 1} Sources)`;

  const isMulti = sources.length > 1;

  const branchNodes: MindMapNode[] = sources.flatMap((src, sIdx): MindMapNode[] => {
    const segs = src.segments.slice(0, 4);
    const parentId = `branch_${sIdx}`;
    const agreement: AgreementStatus | undefined = isMulti
      ? sIdx === 0
        ? 'consensus'
        : 'unique'
      : undefined;

    const firstSeg = segs[0];
    const firstAnchor: SourceAnchor[] = firstSeg
      ? [
          {
            sourceId: src.id,
            segmentId: firstSeg.id,
            sourceType: src.type,
            label:
              src.type === 'youtube' && firstSeg.startSec !== undefined
                ? `▶ ${formatTimestampSec(firstSeg.startSec)}`
                : firstSeg.pageNumber
                  ? `Page ${firstSeg.pageNumber}`
                  : firstSeg.heading || src.originLabel,
            excerpt: firstSeg.text.slice(0, 220),
            pageNumber: firstSeg.pageNumber,
            timestampSec: firstSeg.startSec,
            agreement,
          },
        ]
      : [];

    if (sources.length === 1 && segs.length > 1) {
      return segs.map((seg, idx) => {
        const nodeId = `n_${sIdx}_${idx}`;
        const label =
          src.type === 'youtube' && seg.startSec !== undefined
            ? `▶ ${formatTimestampSec(seg.startSec)}`
            : seg.pageNumber
              ? `Page ${seg.pageNumber}`
              : seg.heading || `Section ${idx + 1}`;
        return {
          id: nodeId,
          parentId: 'root',
          topic: seg.heading || `Key Concept ${idx + 1}`,
          summary: seg.text.slice(0, 180),
          level: 1,
          mastery: 'untested' as const,
          anchors: [
            {
              sourceId: src.id,
              segmentId: seg.id,
              sourceType: src.type,
              label,
              excerpt: seg.text.slice(0, 240),
              pageNumber: seg.pageNumber,
              timestampSec: seg.startSec,
            },
          ],
          lenses: [],
          children: [],
        };
      });
    }

    const children: MindMapNode[] = segs.map((seg, cIdx) => {
      const label =
        src.type === 'youtube' && seg.startSec !== undefined
          ? `▶ ${formatTimestampSec(seg.startSec)}`
          : seg.pageNumber
            ? `Page ${seg.pageNumber}`
            : seg.heading || `Excerpt ${cIdx + 1}`;
      return {
        id: `${parentId}_c${cIdx}`,
        parentId,
        topic: seg.heading || `Insight ${cIdx + 1}`,
        summary: seg.text.slice(0, 170),
        level: 2,
        mastery: 'untested',
        anchors: [
          {
            sourceId: src.id,
            segmentId: seg.id,
            sourceType: src.type,
            label,
            excerpt: seg.text.slice(0, 240),
            pageNumber: seg.pageNumber,
            timestampSec: seg.startSec,
            agreement,
          },
        ],
        lenses: [],
        children: [],
      };
    });

    return [
      {
        id: parentId,
        parentId: 'root',
        topic: src.title.slice(0, 60),
        summary: `Synthesized ${src.segments.length} grounded segments from ${src.originLabel}.`,
        level: 1,
        mastery: 'untested',
        anchors: firstAnchor,
        lenses: [],
        children,
      },
    ];
  });

  const crossLinks: CrossLink[] =
    branchNodes.length >= 2
      ? [
          {
            id: `xl_det_${crypto.randomUUID().slice(0, 6)}`,
            sourceNodeId: branchNodes[0].id,
            targetNodeId: branchNodes[1].id,
            relation: 'bridges',
            label: isMulti ? 'cross-source link' : 'related idea',
            rationale: 'Connects foundational context with subsequent extracted section.',
            isAiSuggested: true,
          },
        ]
      : [];

  const walkthrough: WalkthroughStep[] = [
    {
      stepIndex: 0,
      nodeId: 'root',
      headline: rootTitle,
      narrative: `Overview synthesized from ${sources.length} source${sources.length > 1 ? 's' : ''}.`,
      durationSec: 5,
    },
    ...branchNodes.slice(0, 5).map((node, i) => ({
      stepIndex: i + 1,
      nodeId: node.id,
      headline: node.topic,
      narrative: node.summary,
      durationSec: 6,
    })),
  ];

  return {
    id: `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    schemaVersion: 1,
    title: rootTitle,
    subtitle: `Offline Grounded Synthesis · ${sources.length} Source${sources.length > 1 ? 's' : ''} (Configure an AI key in Settings for deep semantic expansion)`,
    layoutMode: 'balanced',
    sources,
    rootNode: {
      id: 'root',
      parentId: null,
      topic: rootTitle,
      summary: `Grounded synthesis spanning ${sources.map((s) => s.title).join(' + ')}.`,
      level: 0,
      mastery: 'untested',
      anchors: [],
      lenses: [],
      children: branchNodes,
    },
    crossLinks,
    blindSpots: [
      {
        id: `bs_det_${crypto.randomUUID().slice(0, 6)}`,
        title: 'Counter-Arguments & Edge Cases',
        missingPerspective:
          'Add a contrasting source or configure a live AI key to run deep topological blind-spot detection.',
        whyItMatters: 'Examining opposing assumptions prevents single-source confirmation bias.',
        suggestedParentNodeId: 'root',
        suggestedTopic: 'Limitations & Open Questions',
        suggestedSummary: 'Critical boundary conditions and unresolved hypotheses in this domain.',
        resolved: false,
      },
    ],
    walkthrough,
    chatMessages: [],
    createdAt: now,
    updatedAt: now,
  };
}
