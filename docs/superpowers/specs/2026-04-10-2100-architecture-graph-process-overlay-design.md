# Architecture Graph Process Overlay Design Spec

**Capability:** wiki-bi-dashboard
**Implementation repo:** noplasticnoproblem-business-intelligence-dashboard
**Wiki build node:** wiki/business/builds/2026-04-10-2100-architecture-graph-process-overlay.md (created after approval)
**Date:** 2026-04-10

---

## Overview

The architecture graph currently overlays process step nodes as disconnected floating elements — dagre does not receive step→arch interaction edges, so steps land randomly rather than between the arch nodes they bridge. The Data Flow toggle (which drew arch→arch edges via `reads_from`/`writes_to`/`calls` on arch objects) is now a dead toggle since those fields were emptied by the process maturity migration.

This spec redesigns the architecture graph's process step overlay to show steps as proper intermediate nodes in a DFD-style layout: steps sit between the arch nodes they connect, with typed directed edges in and out.

Additional scope:
- Process step detail panel with traversal buttons
- Timeline bar showing the selected process's step sequence
- Implementation step highlighting extended to cover `affects_process_steps`

---

## Section 1: Graph Model

### No process selected (base view)

- Dagre runs with arch nodes only. Same as today.
- Toggles: "Show requires" (dashed dependency arrows between arch nodes). Unchanged.
- **Data Flow toggle removed.** The `reads_from`/`writes_to`/`calls` fields on arch objects are empty post-migration. The toggle is dead UI — remove it entirely.

### Process selected

Dagre re-runs with all arch nodes + the selected process's step nodes + three classes of edges:

**Interaction edges** (drive positioning and carry semantic meaning as ReactFlow edges):
- For each `reads_from` entry on a step: dagre edge `arch_node → step`
- For each `writes_to` or `calls` entry on a step: dagre edge `step → arch_node`

**Sequence edges** (positioning signal only, visually quiet):
- `step_i → step_{i+1}` for each consecutive pair in the process's `steps` list
- Rendered as thin, light gray dashed lines with no arrowhead — they carry dagre's ordering signal but do not compete visually with interaction edges

**Requires edges** (arch→arch, togglable):
- Unchanged. Drawn between arch nodes only. Toggle remains.

### Containment (`part_of`)

Unchanged. Visual nesting of child arch nodes inside parent containers is unaffected by process step overlay.

### Subprocess steps

Process `steps` lists can contain `{type: subprocess, ref}` entries. These are not process step files — skip them when building the dagre graph and the timeline bar. Only `{type: step, ref}` entries are rendered.

---

## Section 2: Layout Strategy

- **Base arch layout:** dagre runs once with arch nodes only when no process is selected.
- **Process layout:** when a process is selected, dagre re-runs from scratch with arch nodes + step nodes + all edge classes above. Arch node positions may shift to accommodate steps. This is intentional — the layout is optimised for the selected process.
- **Layout direction:** LR (left-to-right), unchanged.
- **Step node dagre dimensions:** 160×52px (matches rendered size).
- Switching processes triggers a full dagre re-run. Deselecting a process triggers a re-run with arch nodes only.

---

## Section 3: Visual Design

### Process step nodes

- **Size:** 160×52px (vs arch nodes at 210×78px — clearly subordinate)
- **Shape:** white background, `rounded`, `border` (1px), `border-blue-200` default / `border-indigo-500` when selected / `ring-2 ring-indigo-300` when selected
- **Left actor stripe:** 4px solid stripe, same color scheme as ProcessGraph:
  - `system` → `#3b82f6` (blue)
  - `user` → `#22c55e` (green)
  - `human` → `#f59e0b` (amber)
- **Actor icon** (top-left, 12px): lucide-react icons — `Bot` for system, `User` for user, `UserCheck` for human. Same visual language as arch node type icons.
- **Name text:** truncated with `line-clamp-2`, `text-xs font-medium text-gray-800`
- **Interaction type badges** (bottom-right, inside node): compact colored chips, one per architecture interaction entry:
  - `← reads` (blue) for `reads_from`
  - `writes →` (green) for `writes_to`
  - `calls →` (purple) for `calls`
  - Font: `text-[10px]`, pill shape, colored background + text
  - No labels on edges — all interaction semantics live on the node
- **`external_calls` field** (third-party API names, not arch objects): shown as a `ext →` gray badge per entry. No edges are drawn — external calls have no arch node targets in the graph.

### Edges (process selected)

- **Interaction edges** (arch→step, step→arch): solid colored arrows, `strokeWidth: 1.5`, `MarkerType.ArrowClosed`. Color matches interaction type: blue (`reads_from`), green (`writes_to`), purple (`calls`). No edge labels.
- **Sequence edges** (step→step): `stroke: #e5e7eb`, `strokeWidth: 1`, `strokeDasharray: '4 3'`, no arrowhead marker.
- **Requires edges** (arch→arch): unchanged — dashed gray, `MarkerType.ArrowClosed`, togglable.
- All edges use the existing `FloatingEdge` component (border-point routing).

### Dimming untouched arch nodes

When a process is selected, arch nodes **not** touched by any step in that process render at `opacity: 0.3`. Applied as an inline style on the ReactFlow node's outer wrapper (not via color overrides — preserves status colors while making nodes recede visually).

"Touched" = the arch node's slug appears in at least one step's `architecture` list for the selected process.

Dimming does **not** apply when an implementation step is selected from the left panel — all nodes remain full opacity in that mode.

### Implementation step highlighting (extended)

`ImplementationStep` type and loader updated to include two new optional fields:
- `affects_processes?: string[]`
- `affects_process_steps?: string[]`

`highlightedSlugs` (currently a single `Set<string>` of arch slugs) splits into:
- `highlightedArchSlugs: Set<string>` — from `selectedStep.architecture`
- `highlightedStepSlugs: Set<string>` — from `selectedStep.affects_process_steps ?? []`

Both sets drive the same orange border + warm background highlight treatment on their respective node types. `ProcessStepNode` must be updated to accept an `isHighlighted: boolean` prop (not currently present) and apply the same orange border + warm background treatment as arch nodes when true.

---

## Section 4: Detail Panel

The right-side detail panel is extended to handle process step nodes in addition to arch nodes. At most one panel is open at a time. Selecting a node of either type opens its panel; selecting the same node again or clicking elsewhere closes it.

### Type indicator

Panel header contains a coloured type badge:
- Arch node: `Architecture Object` — indigo badge (`bg-indigo-100 text-indigo-800`)
- Process step: `Process Step` — blue badge (`bg-blue-100 text-blue-800`)

Name and status badge appear below the type indicator.

### Process step panel content

```
[type badge: Process Step]
[step name]
[status badge]  [actor icon + actor label]

── Interactions ──────────────────────
[reads_from chip → clickable arch node name]
[writes_to chip → clickable arch node name]
[calls chip → clickable arch node name]

── Processes ─────────────────────────
[process name list]

── Notes ─────────────────────────────
[body markdown]

── [← prev step name]  [next step name →] ──
```

Clicking an arch node name in the Interactions section selects that arch node in the graph and opens its panel.

### Traversal buttons

Shown in the panel footer when a process step is selected **and** a process is active. Two buttons side by side, spanning the panel width:

- `← [prev step name]` (left-aligned) — previous step in the process's `steps` list
- `[next step name] →` (right-aligned) — next step
- Step names truncated to fit
- Clicking either: selects that step in the graph + opens its panel
- At the first step: no previous button. At the last step: no next button.
- Not shown if no process is selected (no sequence context).

Traversal follows the **process step sequence only** (ordered `steps` list from the process file). It does not traverse arch nodes.

---

## Section 5: Timeline Bar

A horizontal strip anchored to the bottom of the graph viewport. Spans only the graph area — does not extend under the left step-list panel or right detail panel. Appears only when a process is selected.

### Layout

- Fixed height: 36px
- Background: white, `border-t border-gray-200`, subtle top shadow
- Horizontally scrollable row of step chips
- Process name label at the left end (non-clickable): `[process name] ▸` — `text-xs font-semibold text-gray-500`

### Step chips

- One chip per `{type: step}` entry in the process's `steps` list, in order
- Chip content: actor icon (12px) + step name (truncated, `text-xs`)
- Chip left edge: 3px colored stripe (actor color — same as node stripe)
- Default: `bg-gray-50 border border-gray-200 rounded text-gray-700`
- Selected: `bg-indigo-600 text-white border-indigo-600`
- Clicking a chip: selects that step in the graph + opens its detail panel

### Subprocess entries

`{type: subprocess}` entries in the process's `steps` list are skipped in the timeline bar.

---

## Section 6: Controls / Toggle Cleanup

**Removed:**
- "Show data flow" toggle — dead UI, `reads_from`/`writes_to`/`calls` on arch objects are empty

**Unchanged:**
- "Show requires" toggle
- Process selector (existing multi-select or single-select dropdown)
- "Show process steps" toggle (controls whether step nodes appear when a process is selected)
- "Show arch objects" toggle

**Process selector behaviour:**
- Timeline bar and step overlay activate only when exactly one process is selected
- If multiple processes are selected, step nodes from all selected processes are shown but the timeline bar is hidden (no single sequence to display) and traversal buttons are hidden

---

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `affects_processes?: string[]` and `affects_process_steps?: string[]` to `ImplementationStep` |
| `lib/loadImplementationSteps.ts` | Load `affects_processes` and `affects_process_steps` from frontmatter |
| `app/components/ArchitectureGraph.tsx` | All graph model, layout, visual, panel, traversal, and timeline changes |

No new files. No changes to loaders, page, or other components.

---

## Definition of Done

- Selecting a process in the architecture graph re-runs dagre with step nodes included; steps appear between their connected arch nodes
- Arch nodes not touched by the selected process are dimmed to 0.3 opacity
- Step nodes display actor icon, name, and interaction type badges; no interaction labels on edges
- Data Flow toggle is removed from the UI
- Sequence edges (step→step) are rendered as thin dashed gray lines, visually subordinate
- Clicking a process step node opens the detail panel with type badge, interactions, processes, notes, and traversal buttons
- Traversal buttons navigate the process step sequence; correct prev/next at boundaries
- Timeline bar appears below the graph when a process is selected; chips reflect step sequence; clicking a chip selects the step
- Timeline bar hidden when multiple processes are selected
- `ImplementationStep` type includes `affects_process_steps`; loader reads it; highlighted step nodes use orange border treatment
- Dimming does not apply when an implementation step is selected from the left panel
