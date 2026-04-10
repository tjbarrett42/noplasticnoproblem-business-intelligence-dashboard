# Architecture Tab Design Spec

**Capability:** wiki-bi-dashboard
**Implementation repo:** noplasticnoproblem-business-intelligence-dashboard
**Implementation step:** wiki/business/builds/2026-04-09-1600-architecture-tab.md (created after approval)
**Date:** 2026-04-09

---

## Goal

Add an Architecture tab to the BI dashboard that renders `wiki/architecture/*.md` objects as an interactive graph with typed relationship edges, implementation step context, and node detail panels — giving a real-time view of what is proposed vs accepted vs built, what is blocked and why, and which implementation steps touch which objects.

---

## Layout

Four panels managed by React state. All panels transition width with CSS (no animation library needed).

```
┌──────────┬─────────────┬──────────────────────┬────────────┐
│ Step     │ Step Detail │ Architecture Graph   │ Node       │
│ List     │ (280px,     │ (ReactFlow + dagre)  │ Detail     │
│ (200px,  │ opens on    │ flex-1               │ (280px,    │
│ collapse)│ step click) │                      │ on click)  │
└──────────┴─────────────┴──────────────────────┴────────────┘
```

- Step list has a collapse toggle (chevron button) — collapses to 0px, persists graph context
- Step detail has a close (×) button — collapses panel; graph highlight of the active step remains until user clicks blank graph space or a different step
- Node detail has a close (×) button — same pattern as existing Capabilities and Operations tabs
- All widths are fixed constants; graph fills remaining flex-1 space

---

## Data Model

### New types — add to `lib/types.ts`

```typescript
export type ArchObjectType =
  | 'data-store'
  | 'schema'
  | 'service'
  | 'pipeline'
  | 'interface'
  | 'library'
  | 'config';

export type ArchObjectStatus = 'proposed' | 'accepted' | 'built' | 'deprecated';

export type StepStatus = 'ready' | 'blocked' | 'in-progress' | 'done' | 'abandoned';

export interface ArchitectureObject {
  slug: string;
  node: string;
  type: ArchObjectType;
  status: ArchObjectStatus;
  capabilities: string[];
  requires: string[];
  reads_from: string[];
  writes_to: string[];
  calls: string[];
  part_of: string[];
  exposes: string[];
  blockers: string[];
  notes: string;
  body: string;
}

export interface ImplementationStep {
  id: string;
  capabilities_supported: string[];
  architecture: string[];
  status: StepStatus;
  blockers: string[];
  artifacts: { type: string; path: string; repo?: string }[];
  notes: string;
  body: string;
}
```

### New loaders

**`lib/loadArchitectureObjects.ts`**
- Reads `wiki/architecture/*.md` (excludes `.gitkeep`)
- Uses same `wikiPath()` helper pattern as `loadCapabilities.ts`
- All list fields (`requires`, `reads_from`, `writes_to`, `calls`, `part_of`, `exposes`, `capabilities`, `blockers`) default to `[]` if absent
- `status` defaults to `'proposed'` if absent

**`lib/loadImplementationSteps.ts`**
- Reads `wiki/business/builds/*.md` (excludes `.gitkeep`)
- `id` = filename without `.md`
- All list fields default to `[]` if absent
- `artifacts` items: `{ type, path, repo? }` — parse as array of objects

### Page integration

`app/page.tsx` calls both new loaders alongside existing three. Passes `archObjects` and `steps` as props to `Dashboard`. Dashboard passes them to the Architecture tab component.

---

## Graph: Nodes

Each architecture object renders as a custom ReactFlow node (rectangle).

### Node zones

```
┌──────────────────────────────────────┐
│ [icon] [type label]    [status badge]│
│ node name (slug if node absent)      │
│ ⚠ N blockers  (only if blockers > 0) │
└──────────────────────────────────────┘
```

### Status colors

| Status | Background | Border |
|--------|-----------|--------|
| `proposed` | `bg-gray-100` | `border-gray-300` |
| `accepted` | `bg-blue-50` | `border-blue-400` |
| `built` | `bg-green-50` | `border-green-400` |
| `deprecated` | `bg-gray-50` | `border-gray-200` + text faded |

Nodes with one or more blockers render with a 3px orange left border stripe, regardless of status. This is the primary "needs attention" signal.

### Icons — add `lucide-react` dependency

| Type | Lucide icon |
|------|------------|
| `data-store` | `Database` |
| `schema` | `FileText` |
| `service` | `Server` |
| `pipeline` | `Workflow` |
| `interface` | `Layers` |
| `library` | `Package` |
| `config` | `Settings` |

Icon renders at 14px, same color as border (status-matched). Type label is `text-xs text-gray-500` inline with icon.

### Selected / highlighted states

- **Selected** (clicked directly): 2px indigo ring (`ring-2 ring-indigo-400`)
- **Highlighted** (touched by selected implementation step): 2px orange ring (`ring-2 ring-orange-400`)
- A node can be both selected and highlighted simultaneously; indigo ring takes visual precedence

---

## Graph: Edges

Two independently togglable groups. Toggles live in the graph toolbar (top of graph panel).

### Requires edges (default: ON)

- Style: dashed gray arrow (`strokeDasharray: '5 3'`, `stroke: '#9ca3af'`)
- Direction: A → B means "A cannot reach `accepted` until B is `accepted`"
- Arrow points toward the prerequisite (the thing that must exist first)
- No label

### Data flow edges (default: OFF)

Three relationship types, all solid lines with labels:

| Relationship | Color | Label |
|-------------|-------|-------|
| `reads_from` | blue (`#3b82f6`) | "reads" |
| `writes_to` | green (`#22c55e`) | "writes" |
| `calls` | purple (`#a855f7`) | "calls" |

Labels rendered as small inline ReactFlow edge labels (`text-xs`).

### part_of — group nodes

Objects that appear in another object's `part_of` field are rendered as ReactFlow group nodes (enclosing background rectangle with label). The parent object's node acts as the group container. Group background: `bg-gray-50` with `border border-dashed border-gray-300`.

`exposes` is not rendered as an edge — shown in node detail panel only.

### Layout

Dagre LR (left-to-right) using `requires` edges as the primary layout input. Data flow edges are added after layout and do not affect node positions. Same dagre configuration as `CapabilityDAG.tsx`.

---

## Step List Panel

Fixed width: 200px. Collapsible to 0px via chevron toggle.

```
┌─────────────────────┐
│ Implementation  [‹] │
│ Steps               │
├─────────────────────┤
│ ● schema-seed       │  ← status dot + truncated name
│   [blocked] 3 ▲     │  ← badge + blocker count
└─────────────────────┘
```

- Step names truncated from the `id` field: strip date prefix (`YYYY-MM-DD-HHMM-`), replace hyphens with spaces
- Status dot and badge colors: blocked=orange, ready=blue, in-progress=purple, done=green, abandoned=gray
- Blocker count shown only when `status === 'blocked'`
- Active (selected) step: `bg-indigo-50` row background
- Clicking a step: sets active step, opens step detail panel, highlights touched arch objects in graph

---

## Step Detail Panel

Fixed width: 280px. Opens when step clicked. Closed by × button.

Sections (only rendered if content exists):

1. **Header** — formatted step name + status badge + × close
2. **Blockers** — orange-tinted section; each blocker as a bullet. Omitted if none.
3. **Architecture objects** — list of slugs from `step.architecture[]`; each shows status dot and node name; clicking selects that node in graph and opens node detail
4. **Capabilities supported** — list of slugs from `step.capabilities_supported[]`; plain text (no navigation)
5. **Artifacts** — list of `{ type, path, repo? }` entries; path rendered as monospace text; `repo` shown as prefix if present

Closing step detail does not clear the step selection or graph highlight.

---

## Node Detail Panel

Fixed width: 280px. Opens when node clicked. Closed by × button.

Sections (only rendered if content exists):

1. **Header** — icon + type + status badge + node name + × close
2. **Blockers** — orange-tinted section; each blocker as bullet. Omitted if none.
3. **Responsibilities** — first paragraph of `body` text. Truncated at 300 chars with "…show more" toggle.
4. **Relationships** — two sub-sections:
   - *Required by*: reverse lookup — other arch objects whose `requires[]` contains this slug
   - *Part of*: value of `part_of[]` for this object
5. **Implementation steps** — reverse lookup: all steps whose `architecture[]` includes this slug; each shows status dot + formatted name; clicking selects that step in the list and opens step detail
6. **Capabilities** — `capabilities[]` field; slug list, plain text

---

## Header Stats

Add to existing summary bar in `Dashboard.tsx`:

```
... | 2 ops defined | 2 arch objects | 0 accepted
```

- "arch objects": total count, color `text-indigo-600`
- "accepted": count where `status === 'accepted' || status === 'built'`, color `text-teal-600`

---

## Tab Integration

New permanent tab "Architecture" added after "Operations", before dynamic tabs:

```tsx
<button
  onClick={() => setActiveTabId('architecture')}
  className={`... ${activeTabId === 'architecture'
    ? 'border-indigo-500 text-indigo-600'
    : 'border-transparent text-gray-500 hover:text-gray-700'
  }`}
>
  Architecture
</button>
```

No selected-node badge in the tab label. Architecture view manages its own selection state internally within the `ArchitectureGraph` component.

---

## New Files

| File | Action |
|------|--------|
| `lib/types.ts` | Modify — add `ArchitectureObject`, `ImplementationStep`, `ArchObjectType`, `ArchObjectStatus`, `StepStatus` |
| `lib/loadArchitectureObjects.ts` | Create |
| `lib/loadImplementationSteps.ts` | Create |
| `app/components/ArchitectureGraph.tsx` | Create |
| `app/components/Dashboard.tsx` | Modify — add Architecture tab, new props |
| `app/page.tsx` | Modify — call new loaders, pass props |

**New dependency:** `lucide-react`

---

## Out of Scope

- Filtering architecture objects by capability (future)
- Navigation from architecture node to Capabilities tab (future)
- Resizable panels (future)
- Edge labels for `requires` edges (future — currently no-label dashed arrows)
- Rendering `exposes` as a graph edge (future)
