# Architecture Graph Process Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the architecture graph to show process steps as proper intermediate nodes between the arch nodes they connect, with typed edges, dimming, a detail panel with traversal, and a timeline bar.
**Capability:** wiki-bi-dashboard
**Spec:** docs/superpowers/specs/2026-04-10-2100-architecture-graph-process-overlay-design.md
**Build node:** wiki/business/builds/2026-04-10-2100-architecture-graph-process-overlay.md
**Architecture:** Single-file redesign of ArchitectureGraph.tsx — step nodes are added to dagre before layout (not after), with typed interaction edges and sequence edges driving correct positioning. The right-side detail panel is unified to handle both arch nodes and process step nodes via a single `selectedNodeId` state. A timeline bar renders below the ReactFlow canvas when exactly one process is selected.
**Tech Stack:** React, ReactFlow (@xyflow/react), dagre (@dagrejs/dagre), lucide-react, TypeScript, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `lib/types.ts` | Add `affects_processes?` and `affects_process_steps?` to `ImplementationStep` |
| `lib/loadImplementationSteps.ts` | Read `affects_processes` and `affects_process_steps` from frontmatter |
| `app/components/ArchitectureGraph.tsx` | Full redesign — all tasks below |

---

### Task 1: Extend ImplementationStep type and loader

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/loadImplementationSteps.ts`

- [ ] **Step 1: Fix ProcessStepStatus enum and ProcessStep type**

In `lib/types.ts`, replace:
```typescript
export type ProcessStepStatus = 'draft' | 'defined' | 'deprecated';
```
With:
```typescript
export type ProcessStepStatus = 'draft' | 'designed' | 'stable' | 'deprecated';
```

Also add `blockers` and `external_calls` to the `ProcessStep` interface:
```typescript
export interface ProcessStep {
  id: string;
  name: string;
  actor: StepActor;
  architecture: ArchInteractionLink[];
  processes: string[];
  status: ProcessStepStatus;
  blockers: string[];
  external_calls: string[];
  notes: string;
  body: string;
}
```

- [ ] **Step 2: Update loadProcessSteps loader**

In `lib/loadProcessSteps.ts`, add to the return object:
```typescript
blockers: Array.isArray(data.blockers) ? data.blockers : [],
external_calls: Array.isArray(data.external_calls) ? data.external_calls : [],
```

- [ ] **Step 3: Add optional fields to ImplementationStep in types.ts**

Find the `ImplementationStep` interface and add after `artifacts`:
```typescript
export interface ImplementationStep {
  id: string;
  capabilities_supported: string[];
  architecture: string[];
  status: StepStatus;
  blockers: string[];
  artifacts: { type: string; path: string; repo?: string }[];
  affects_processes: string[];
  affects_process_steps: string[];
  notes: string;
  body: string;
}
```

- [ ] **Step 4: Update loadImplementationSteps loader**

In `loadImplementationSteps.ts`, add to the return object after `artifacts`:
```typescript
affects_processes: Array.isArray(data.affects_processes) ? data.affects_processes : [],
affects_process_steps: Array.isArray(data.affects_process_steps) ? data.affects_process_steps : [],
```

- [ ] **Step 5: Commit**
```bash
git add lib/types.ts lib/loadImplementationSteps.ts lib/loadProcessSteps.ts
git commit -m "feat: add affects_processes/affects_process_steps to ImplementationStep; fix ProcessStep type (blockers, external_calls, status enum)"
```

---

### Task 2: Remove Data Flow toggle and dead code from ArchitectureGraph

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Remove showDataFlow state**

Remove this line from component state:
```typescript
const [showDataFlow, setShowDataFlow] = useState(false);
```

- [ ] **Step 2: Remove showDataFlow from buildArchLayout call**

In the `useMemo` that calls `buildArchLayout`, remove `showDataFlow` from both the arguments and the dependency array.

- [ ] **Step 3: Remove showDataFlow parameter from buildArchLayout signature**

Remove `showDataFlow: boolean,` from the function signature.

- [ ] **Step 4: Remove the data flow edge building block**

Remove the entire `if (showDataFlow) { ... }` block (lines ~426–451 in original) that builds `reads_from`/`writes_to`/`calls` edges from arch objects.

- [ ] **Step 5: Remove the Data Flow checkbox from the toolbar JSX**

Remove:
```jsx
<label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
  <input
    type="checkbox"
    checked={showDataFlow}
    onChange={(e) => setShowDataFlow(e.target.checked)}
    className="rounded"
  />
  Data flow edges
</label>
```

- [ ] **Step 6: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: remove dead data flow toggle (arch object interaction fields emptied)"
```

---

### Task 3: Redesign ProcessStepNode component

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Update size constants**

Replace:
```typescript
const PROC_STEP_W = 200;
const PROC_STEP_H = 64;
```
With:
```typescript
const PROC_STEP_W = 160;
const PROC_STEP_H = 52;
```

- [ ] **Step 2: Add actor icon map after TYPE_ICONS**

```typescript
import { Bot, User, UserCheck } from 'lucide-react';

const ACTOR_ICONS: Record<StepActor, LucideIcon> = {
  system: Bot,
  user: User,
  human: UserCheck,
};
```

(Add `Bot`, `User`, `UserCheck` to the lucide-react import at the top of the file.)

- [ ] **Step 3: Update ProcessStepNodeData type and component**

Replace the existing `ProcessStepNode` function with:
```typescript
type ProcessStepNodeData = {
  step: ProcessStep;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
};

function ProcessStepNode({ data }: { data: ProcessStepNodeData }) {
  const { step, isSelected, isHighlighted, onSelect } = data;
  const stripeColor =
    step.actor === 'system' ? '#3b82f6'
    : step.actor === 'user' ? '#22c55e'
    : '#f59e0b';
  const ActorIcon = ACTOR_ICONS[step.actor];

  const interactionBadges = step.architecture.map((link) => ({
    label: link.interaction === 'reads_from' ? '← reads'
          : link.interaction === 'writes_to' ? 'writes →'
          : 'calls →',
    color: link.interaction === 'reads_from' ? '#3b82f6'
          : link.interaction === 'writes_to' ? '#22c55e'
          : '#a855f7',
    bg: link.interaction === 'reads_from' ? '#eff6ff'
       : link.interaction === 'writes_to' ? '#f0fdf4'
       : '#faf5ff',
  }));
  const externalBadges = step.external_calls;

  return (
    <div
      onClick={onSelect}
      className="relative bg-white rounded overflow-hidden cursor-pointer"
      style={{
        width: PROC_STEP_W,
        height: PROC_STEP_H,
        border: isSelected
          ? '1.5px solid #6366f1'
          : isHighlighted
          ? '1.5px solid #f97316'
          : '1px solid #bfdbfe',
        boxShadow: isSelected
          ? '0 0 0 2px #c7d2fe'
          : isHighlighted
          ? '0 0 0 2px #fed7aa'
          : undefined,
        background: isHighlighted ? '#fff7ed' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      {/* Actor stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: stripeColor }} />
      <div className="pl-3 pr-2 pt-1.5 pb-1 h-full flex flex-col justify-between">
        {/* Top row: actor icon + name */}
        <div className="flex items-start gap-1">
          <ActorIcon size={11} className="shrink-0 mt-0.5" style={{ color: stripeColor }} />
          <span className="text-[11px] font-medium text-gray-800 leading-tight line-clamp-2">{step.name}</span>
        </div>
        {/* Bottom row: interaction badges */}
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {interactionBadges.map((b, i) => (
            <span
              key={i}
              className="text-[9px] px-1 py-0.5 rounded font-medium"
              style={{ color: b.color, background: b.bg }}
            >
              {b.label}
            </span>
          ))}
          {externalBadges.map((name, i) => (
            <span key={`ext-${i}`} className="text-[9px] px-1 py-0.5 rounded font-medium text-gray-500 bg-gray-100">
              ext →
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update combinedNodeTypes to cast correctly**
```typescript
const combinedNodeTypes: NodeTypes = {
  arch: ArchNode,
  'process-step': ProcessStepNode as unknown as NodeTypes['process-step'],
};
```

- [ ] **Step 5: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: redesign ProcessStepNode with actor icons, interaction badges, isHighlighted"
```

---

### Task 4: Add isDimmed prop to ArchNode

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Add isDimmed to ArchNodeData type**

```typescript
type ArchNodeData = {
  object: ArchitectureObject;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: () => void;
  containerHeight?: number;
  containerWidth?: number;
};
```

- [ ] **Step 2: Apply opacity in ArchNode component**

In the `ArchNode` function, destructure `isDimmed` from `data` and wrap the outer fragment in a div with opacity:

```typescript
function ArchNode({ data }: { data: ArchNodeData }) {
  const { object, isSelected, isHighlighted, isDimmed, onClick, containerHeight, containerWidth } = data;
  // ... (rest unchanged)

  return (
    <div style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.15s' }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        onClick={onClick}
        // ... (rest of inner div unchanged)
      >
        {/* ... existing content ... */}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}
```

Note: The outer `<>` fragment is replaced with a `<div>` to allow the opacity style. Handles move inside this wrapper div.

- [ ] **Step 3: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: add isDimmed prop to ArchNode for process step overlay dimming"
```

---

### Task 5: Rebuild buildArchLayout — dagre step integration and new edge model

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

This task replaces the process step section of `buildArchLayout` with a new approach: steps are added to dagre before layout (not after), interaction edges replace bridge edges, and sequence edges are added.

- [ ] **Step 1: Update buildArchLayout signature**

Replace:
```typescript
function buildArchLayout(
  objects: ArchitectureObject[],
  selectedSlug: string | null,
  highlightedSlugs: Set<string>,
  showRequires: boolean,
  showDataFlow: boolean,
  onSelectNode: (slug: string | null) => void,
  resolvedProcessSteps: ProcessStep[] = [],
  showProcessSteps = false,
  showArchObjects = true,
): { nodes: Node[]; edges: Edge[] }
```
With:
```typescript
function buildArchLayout(
  objects: ArchitectureObject[],
  selectedNodeId: string | null,
  highlightedArchSlugs: Set<string>,
  highlightedStepSlugs: Set<string>,
  showRequires: boolean,
  onSelectNode: (id: string | null) => void,
  resolvedProcessSteps: ProcessStep[],
  orderedProcessSteps: ProcessStep[],
  showProcessSteps: boolean,
  showArchObjects: boolean,
): { nodes: Node[]; edges: Edge[] }
```

- [ ] **Step 2: Update internal references from selectedSlug/highlightedSlugs**

Inside the function body, replace:
- `selectedSlug` → `selectedNodeId`
- `highlightedSlugs` → `highlightedArchSlugs`

Update `isActive` checks in requires edge building to use `highlightedArchSlugs`.

- [ ] **Step 3: Compute touchedArchSlugs for dimming**

After the containment map setup, add:
```typescript
const touchedArchSlugs = new Set<string>();
if (showProcessSteps && resolvedProcessSteps.length > 0) {
  resolvedProcessSteps.forEach((step) => {
    step.architecture.forEach((link) => {
      if (slugSet.has(link.object)) touchedArchSlugs.add(link.object);
    });
  });
}
const shouldDim = showProcessSteps && resolvedProcessSteps.length > 0 && highlightedArchSlugs.size === 0;
```

- [ ] **Step 4: Add step nodes and edges to dagre before layout**

After the requires edges are added to dagre (before `dagre.layout(g)`), add:
```typescript
if (showProcessSteps && resolvedProcessSteps.length > 0) {
  // Add step nodes to dagre
  resolvedProcessSteps.forEach((step) => {
    if (!g.hasNode(step.id)) {
      g.setNode(step.id, { width: PROC_STEP_W, height: PROC_STEP_H });
    }
  });
  // Add interaction edges to dagre (drives positioning)
  resolvedProcessSteps.forEach((step) => {
    step.architecture.forEach((link) => {
      const archSlug = parentOf.has(link.object) ? parentOf.get(link.object)! : link.object;
      if (!slugSet.has(archSlug)) return;
      if (link.interaction === 'reads_from') {
        g.setEdge(archSlug, step.id);
      } else {
        // writes_to, calls: step → arch
        g.setEdge(step.id, archSlug);
      }
    });
  });
  // Add sequence edges to dagre (ordering signal)
  orderedProcessSteps.forEach((step, idx) => {
    if (idx >= orderedProcessSteps.length - 1) return;
    const next = orderedProcessSteps[idx + 1];
    if (g.hasNode(step.id) && g.hasNode(next.id)) {
      g.setEdge(step.id, next.id);
    }
  });
}
```

- [ ] **Step 5: Run dagre layout once (remove the second dagre.layout call)**

Ensure `dagre.layout(g)` is called exactly once, after all nodes and edges (arch + steps) are registered.

Remove any secondary `dagre.layout(g)` call that was in the step processing section.

- [ ] **Step 6: Update isDimmed in arch node construction**

In the arch node building loop, add `isDimmed` to node data:
```typescript
data: {
  object: o,
  isSelected: selectedNodeId === o.slug,
  isHighlighted: highlightedArchSlugs.has(o.slug),
  isDimmed: shouldDim && !touchedArchSlugs.has(o.slug),
  onClick: () => onSelectNode(selectedNodeId === o.slug ? null : o.slug),
  // ... containerHeight/containerWidth unchanged
},
```

Do the same for child nodes (they inherit parent's dimmed state — check if the parent is in `touchedArchSlugs` OR if the child itself is):
```typescript
data: {
  object: childObj,
  isSelected: selectedNodeId === childSlug,
  isHighlighted: highlightedArchSlugs.has(childSlug),
  isDimmed: shouldDim && !touchedArchSlugs.has(childSlug),
  onClick: () => onSelectNode(selectedNodeId === childSlug ? null : childSlug),
},
```

- [ ] **Step 7: Build ReactFlow process step nodes with onSelect**

Replace the old step node building block with:
```typescript
if (showProcessSteps && resolvedProcessSteps.length > 0) {
  resolvedProcessSteps.forEach((step) => {
    const pos = g.node(step.id);
    if (!pos) return;
    nodes.push({
      id: step.id,
      type: 'process-step',
      position: { x: pos.x - PROC_STEP_W / 2, y: pos.y - PROC_STEP_H / 2 },
      data: {
        step,
        isSelected: selectedNodeId === step.id,
        isHighlighted: highlightedStepSlugs.has(step.id),
        onSelect: () => onSelectNode(selectedNodeId === step.id ? null : step.id),
      },
    });
  });
}
```

- [ ] **Step 8: Build interaction ReactFlow edges (replaces bridge edges)**

After step nodes, add:
```typescript
if (showProcessSteps && resolvedProcessSteps.length > 0 && showArchObjects) {
  const visibleArchIds = new Set(objects.map((o) => o.slug));
  resolvedProcessSteps.forEach((step) => {
    step.architecture.forEach((link) => {
      if (!visibleArchIds.has(link.object)) return;
      const color =
        link.interaction === 'reads_from' ? '#3b82f6'
        : link.interaction === 'writes_to' ? '#22c55e'
        : '#a855f7';
      const [src, tgt] =
        link.interaction === 'reads_from'
          ? [link.object, step.id]
          : [step.id, link.object];
      edges.push({
        id: `interact:${step.id}-${link.object}-${link.interaction}`,
        type: 'floating',
        source: src,
        target: tgt,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 10, height: 10 },
        style: { stroke: color, strokeWidth: 1.5 },
      });
    });
  });

  // Sequence edges (step → step, visually quiet)
  orderedProcessSteps.forEach((step, idx) => {
    if (idx >= orderedProcessSteps.length - 1) return;
    const next = orderedProcessSteps[idx + 1];
    edges.push({
      id: `seq:${step.id}->${next.id}`,
      type: 'floating',
      source: step.id,
      target: next.id,
      style: { stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 3' },
    });
  });
}
```

- [ ] **Step 9: Update finalNodes/finalEdges filter**

The existing filter at the end:
```typescript
const finalNodes = showArchObjects ? nodes : nodes.filter((n) => n.type === 'process-step');
const finalEdges = showArchObjects ? edges : edges.filter((e) => e.id.startsWith('bridge-'));
```

Update the edge filter for the non-arch case (no more bridge- prefix):
```typescript
const finalNodes = showArchObjects ? nodes : nodes.filter((n) => n.type === 'process-step');
const finalEdges = showArchObjects
  ? edges
  : edges.filter((e) => e.id.startsWith('interact:') || e.id.startsWith('seq:'));
```

- [ ] **Step 10: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: add process steps to dagre layout with interaction and sequence edges"
```

---

### Task 6: Refactor component state and layout memo

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Replace selectedSlug with selectedNodeId**

Replace:
```typescript
const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
```
With:
```typescript
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
```

- [ ] **Step 2: Split highlightedSlugs into two sets**

Replace:
```typescript
const highlightedSlugs = useMemo(
  () => (selectedStep ? new Set(selectedStep.architecture) : new Set<string>()),
  [selectedStep],
);
```
With:
```typescript
const highlightedArchSlugs = useMemo(
  () => (selectedStep ? new Set(selectedStep.architecture) : new Set<string>()),
  [selectedStep],
);
const highlightedStepSlugs = useMemo(
  () => (selectedStep ? new Set(selectedStep.affects_process_steps) : new Set<string>()),
  [selectedStep],
);
```

- [ ] **Step 3: Compute orderedProcessSteps**

After `resolvedProcessSteps`, add:
```typescript
const orderedProcessSteps = useMemo(() => {
  if (selectedProcessIds.length !== 1) return [];
  const proc = (processes ?? []).find((p) => p.id === selectedProcessIds[0]);
  if (!proc) return [];
  const allSteps = processSteps ?? [];
  return proc.steps
    .filter((s): s is { type: 'step'; ref: string } => s.type === 'step')
    .map((s) => allSteps.find((ps) => ps.id === s.ref))
    .filter((s): s is ProcessStep => s !== undefined);
}, [processes, processSteps, selectedProcessIds]);
```

- [ ] **Step 4: Update buildArchLayout call in useMemo**

```typescript
const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
  () =>
    buildArchLayout(
      archObjects,
      selectedNodeId,
      highlightedArchSlugs,
      highlightedStepSlugs,
      showRequires,
      setSelectedNodeId,
      resolvedProcessSteps,
      orderedProcessSteps,
      showProcessSteps,
      showArchObjects,
    ),
  [archObjects, selectedNodeId, highlightedArchSlugs, highlightedStepSlugs, showRequires, resolvedProcessSteps, orderedProcessSteps, showProcessSteps, showArchObjects],
);
```

- [ ] **Step 5: Compute selectedObject and selectedProcessStepNode**

Replace:
```typescript
const selectedObject = selectedSlug
  ? archObjects.find((o) => o.slug === selectedSlug) ?? null
  : null;
```
With:
```typescript
const selectedObject = selectedNodeId
  ? archObjects.find((o) => o.slug === selectedNodeId) ?? null
  : null;
const selectedProcessStepNode = selectedNodeId
  ? (processSteps ?? []).find((s) => s.id === selectedNodeId) ?? null
  : null;
```

- [ ] **Step 6: Update onPaneClick**

```typescript
onPaneClick={() => setSelectedNodeId(null)}
```

- [ ] **Step 7: Update selectedStep impl panel arch node clicks**

In the step detail panel, the arch node button calls:
```typescript
onClick={() => setSelectedSlug(selectedSlug === slug ? null : slug)}
```
Update to:
```typescript
onClick={() => setSelectedNodeId(selectedNodeId === slug ? null : slug)}
```

- [ ] **Step 8: Update arch node panel close button and "required by" / impl step clicks**

Replace all remaining `selectedSlug` / `setSelectedSlug` references:
- `setSelectedSlug(null)` → `setSelectedNodeId(null)`
- `setSelectedSlug(o.slug)` → `setSelectedNodeId(o.slug)`
- `selectedSlug === o.slug` → `selectedNodeId === o.slug`

- [ ] **Step 9: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: refactor component state — selectedNodeId, split highlighted sets, orderedProcessSteps"
```

---

### Task 7: Process step detail panel with traversal buttons

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Add type badge constant**

After `STEP_STATUS_STYLES`, add:
```typescript
const PROCESS_STEP_STATUS_STYLES: Record<string, { badge: string }> = {
  draft:      { badge: 'bg-gray-100 text-gray-600' },
  designed:   { badge: 'bg-blue-100 text-blue-800' },
  stable:     { badge: 'bg-green-100 text-green-800' },
  deprecated: { badge: 'bg-gray-50 text-gray-400' },
};
```

- [ ] **Step 2: Add process step detail panel in JSX after the arch node panel**

After the closing `)}` of `{selectedObject && (...)}` and before the final `</div>`, add:

```tsx
{/* ── Process step detail panel ── */}
{selectedProcessStepNode && !selectedObject && (
  <div className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
    {/* Header */}
    <div className="p-4 border-b border-gray-100 shrink-0">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-800">
          Process Step
        </span>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0"
        >
          ×
        </button>
      </div>
      <div className="font-bold text-gray-900 text-sm mb-2">{selectedProcessStepNode.name}</div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          PROCESS_STEP_STATUS_STYLES[selectedProcessStepNode.status]?.badge ?? 'bg-gray-100 text-gray-600'
        }`}>
          {selectedProcessStepNode.status}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          {React.createElement(ACTOR_ICONS[selectedProcessStepNode.actor], { size: 11 })}
          {selectedProcessStepNode.actor}
        </span>
      </div>
    </div>

    {/* Body */}
    <div className="p-4 space-y-4 text-xs flex-1 overflow-y-auto">
      {/* Blockers */}
      {selectedProcessStepNode.blockers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3">
          <div className="font-semibold text-orange-700 mb-1.5 uppercase tracking-wide text-xs">Blockers</div>
          <ul className="space-y-1.5">
            {selectedProcessStepNode.blockers.map((b, i) => (
              <li key={i} className="text-orange-800 leading-snug">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Interactions */}
      {selectedProcessStepNode.architecture.length > 0 && (
        <div>
          <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Interactions</div>
          <div className="space-y-1">
            {selectedProcessStepNode.architecture.map((link, i) => {
              const obj = archObjects.find((o) => o.slug === link.object);
              const color =
                link.interaction === 'reads_from' ? '#3b82f6'
                : link.interaction === 'writes_to' ? '#22c55e'
                : '#a855f7';
              const label =
                link.interaction === 'reads_from' ? '← reads'
                : link.interaction === 'writes_to' ? 'writes →'
                : 'calls →';
              return (
                <button
                  key={i}
                  onClick={() => obj && setSelectedNodeId(obj.slug)}
                  className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[10px] px-1 py-0.5 rounded font-medium shrink-0"
                    style={{ color, background: color + '1a' }}>
                    {label}
                  </span>
                  <span className="text-gray-700 font-medium">{obj?.node ?? link.object}</span>
                  {obj && (
                    <span className={`ml-auto text-xs px-1 py-0.5 rounded ${STATUS_STYLES[obj.status].badge}`}>
                      {obj.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* External calls */}
      {selectedProcessStepNode.external_calls.length > 0 && (
        <div>
          <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">External calls</div>
          <div className="text-gray-600">{selectedProcessStepNode.external_calls.join(', ')}</div>
        </div>
      )}

      {/* Processes */}
      {selectedProcessStepNode.processes.length > 0 && (
        <div>
          <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Processes</div>
          <div className="text-gray-600">{selectedProcessStepNode.processes.join(', ')}</div>
        </div>
      )}

      {/* Notes */}
      {selectedProcessStepNode.body && (
        <div>
          <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</div>
          <p className="text-gray-600 leading-relaxed">
            {selectedProcessStepNode.body.split('\n\n')[0].slice(0, 300)}
            {selectedProcessStepNode.body.split('\n\n')[0].length > 300 ? '…' : ''}
          </p>
        </div>
      )}
    </div>

    {/* Traversal footer */}
    {orderedProcessSteps.length > 0 && (() => {
      const idx = orderedProcessSteps.findIndex((s) => s.id === selectedProcessStepNode.id);
      const prev = idx > 0 ? orderedProcessSteps[idx - 1] : null;
      const next = idx >= 0 && idx < orderedProcessSteps.length - 1 ? orderedProcessSteps[idx + 1] : null;
      if (!prev && !next) return null;
      return (
        <div className="shrink-0 border-t border-gray-100 p-2 flex justify-between gap-1">
          {prev ? (
            <button
              onClick={() => setSelectedNodeId(prev.id)}
              className="flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-gray-600 transition-colors truncate"
              title={prev.name}
            >
              ← {prev.name}
            </button>
          ) : <div className="flex-1" />}
          {next ? (
            <button
              onClick={() => setSelectedNodeId(next.id)}
              className="flex-1 text-right text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-gray-600 transition-colors truncate"
              title={next.name}
            >
              {next.name} →
            </button>
          ) : <div className="flex-1" />}
        </div>
      );
    })()}
  </div>
)}
```

- [ ] **Step 3: Add type badge to existing arch node panel**

In the arch node panel header, add a type badge before the type icon row:
```tsx
<div className="flex items-start justify-between mb-2">
  <span className="text-xs px-2 py-0.5 rounded font-medium bg-indigo-100 text-indigo-800">
    Architecture Object
  </span>
  <button onClick={() => setSelectedNodeId(null)} ...>×</button>
</div>
```

Replace the existing `<div className="flex items-start justify-between mb-2">` block in the arch node panel.

- [ ] **Step 4: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: process step detail panel with type badge and traversal buttons"
```

---

### Task 8: Timeline bar

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx`

- [ ] **Step 1: Add TimelineBar component before the main component**

```typescript
function TimelineBar({
  process: proc,
  orderedSteps,
  selectedNodeId,
  onSelectStep,
}: {
  process: Process;
  orderedSteps: ProcessStep[];
  selectedNodeId: string | null;
  onSelectStep: (id: string) => void;
}) {
  const stripeColor = (actor: StepActor) =>
    actor === 'system' ? '#3b82f6' : actor === 'user' ? '#22c55e' : '#f59e0b';

  return (
    <div
      className="shrink-0 border-t border-gray-200 bg-white overflow-x-auto"
      style={{ height: 36 }}
    >
      <div className="flex items-center h-full px-3 gap-1 min-w-max">
        {/* Process label */}
        <span className="text-xs font-semibold text-gray-400 mr-2 shrink-0 whitespace-nowrap">
          {proc.name} ▸
        </span>
        {orderedSteps.map((step) => {
          const ActorIcon = ACTOR_ICONS[step.actor];
          const isActive = selectedNodeId === step.id;
          return (
            <button
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              title={step.name}
              className="flex items-center gap-1 h-6 pl-0 pr-2 rounded overflow-hidden shrink-0 transition-colors"
              style={{
                background: isActive ? '#4f46e5' : '#f9fafb',
                border: `1px solid ${isActive ? '#4f46e5' : '#e5e7eb'}`,
                maxWidth: 140,
              }}
            >
              {/* Color stripe */}
              <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: stripeColor(step.actor) }} />
              <ActorIcon size={10} className="shrink-0 ml-1.5" style={{ color: isActive ? 'white' : stripeColor(step.actor) }} />
              <span
                className="text-[10px] font-medium truncate ml-0.5"
                style={{ color: isActive ? 'white' : '#374151' }}
              >
                {step.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Compute singleSelectedProcess in the main component**

After `orderedProcessSteps`, add:
```typescript
const singleSelectedProcess = useMemo(() => {
  if (selectedProcessIds.length !== 1) return null;
  return (processes ?? []).find((p) => p.id === selectedProcessIds[0]) ?? null;
}, [processes, selectedProcessIds]);
```

- [ ] **Step 3: Add TimelineBar to graph area JSX**

The graph area is a `<div className="flex-1 flex flex-col overflow-hidden">` containing the toolbar and the ReactFlow canvas. Add the timeline bar between the ReactFlow canvas and the closing div:

```tsx
{/* ── Graph area ── */}
<div className="flex-1 flex flex-col overflow-hidden">
  {/* Graph toolbar */}
  ...existing toolbar...

  {/* ReactFlow canvas */}
  <div className="flex-1">
    <ReactFlow ... />
  </div>

  {/* Timeline bar */}
  {singleSelectedProcess && showProcessSteps && orderedProcessSteps.length > 0 && (
    <TimelineBar
      process={singleSelectedProcess}
      orderedSteps={orderedProcessSteps}
      selectedNodeId={selectedNodeId}
      onSelectStep={(id) => setSelectedNodeId(selectedNodeId === id ? null : id)}
    />
  )}
</div>
```

- [ ] **Step 4: Commit**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "feat: timeline bar showing selected process step sequence"
```

---

### Task 9: Final wiring check and build verification

**Files:**
- Modify: `app/components/ArchitectureGraph.tsx` (fixes only)

- [ ] **Step 1: Verify no remaining selectedSlug references**
```bash
grep -n "selectedSlug\|highlightedSlugs\|showDataFlow" app/components/ArchitectureGraph.tsx
```
Expected: zero matches. Fix any found.

- [ ] **Step 2: Verify no remaining bridge- edge IDs**
```bash
grep -n "bridge-" app/components/ArchitectureGraph.tsx
```
Expected: zero matches. Fix any found.

- [ ] **Step 3: Run TypeScript check**
```bash
cd /Users/timbarrett/Documents/GitHub/noplasticnoproblem-business-intelligence-dashboard
npx tsc --noEmit
```
Fix any type errors before proceeding.

- [ ] **Step 4: Start dev server and verify visually**
```bash
npm run dev
```
Check:
- Architecture tab loads without errors
- No process selected: arch nodes visible, no step nodes, no Data Flow toggle
- Select a process + enable Process steps: step nodes appear between their arch nodes
- Untouched arch nodes are dimmed
- Click a step node: detail panel opens on right with type badge "Process Step", interactions, traversal buttons
- Click an arch node: detail panel shows "Architecture Object" type badge
- Timeline bar appears below graph, chips clickable
- Timeline bar hidden when multiple processes selected (if applicable)
- Select an impl step from left panel: both arch nodes and process step nodes (in affects_process_steps) highlight orange

- [ ] **Step 5: Commit any fixes**
```bash
git add app/components/ArchitectureGraph.tsx
git commit -m "fix: final wiring corrections for process overlay"
```
(Skip this commit if no fixes needed.)
