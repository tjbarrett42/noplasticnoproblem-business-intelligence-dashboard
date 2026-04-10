# Process Layer Design Spec

**Capability:** wiki-process-layer
**Implementation repo:** noplasticnoproblem-business-intelligence-dashboard
**Wiki build node:** wiki/business/builds/2026-04-10-1422-process-layer.md (created after approval)
**Date:** 2026-04-10

---

## Overview

Introduces the process layer — a new wiki artifact type that sits between capabilities (what the system must do) and architecture (what structural components exist). Processes model how information and actions flow through the system, expressed as ordered sequences of steps. Process steps are the primary nodes: each step has a single actor, typed interactions with architecture objects, and can be shared across multiple processes.

This implementation has two parts:
1. **Wiki schema** — new artifact types, directory structure, frontmatter contracts, reverse links on existing artifact types
2. **BI dashboard** — unified graph extending the Architecture tab with process step nodes and process-aware filters; Operations tab replaced by Processes tab

Operations nodes (`wiki/business/operations/`) are deprecated and removed as part of this work.

---

## Part 1: Wiki Schema

### Directory structure

```
wiki/processes/<slug>.md          # process definitions
wiki/process-steps/<slug>.md      # step definitions
```

Both directories are flat (no subdirectories), matching the pattern of `wiki/architecture/`.

### Naming conventions

- **Process slugs:** complete-flow phrases describing an end-to-end flow — `answer-reader-question`, `publish-article`, `ingest-new-content`
- **Step slugs:** single-actor atomic actions — `normalize-query`, `embed-content`, `editorial-review-answer`, `query-knowledge-graph`
- **Test:** if the slug makes sense prefixed with "how to...", it's a process. If it makes sense prefixed with "do...", it's a step.

### Process file format (`wiki/processes/<slug>.md`)

```yaml
---
schema_version: "0.1"
id: <slug>
name: <Human-readable name>
trigger: user-action | schedule | event | subprocess
capabilities: []        # capability slugs this process fulfills (forward link)
steps:                  # ordered list — each item is a step reference or subprocess reference
  - {type: step, ref: <step-slug>}
  - {type: subprocess, ref: <process-slug>}
status: draft | defined | active | deprecated
notes: ""
---
```

**Field semantics:**

- `trigger`: How the process is initiated. `subprocess` means this process is only ever invoked by a parent process and has no independent trigger. This vocabulary is intentionally minimal and may be expanded in a future session when more trigger relationships to system events are designed.
- `capabilities`: Forward links to capability nodes this process fulfills. A process may contribute to multiple capabilities. Populated when the process is defined.
- `steps`: Ordered list of typed references. Two types:
  - `{type: step, ref: <step-slug>}` — references a process step file at `wiki/process-steps/<step-slug>.md`
  - `{type: subprocess, ref: <process-slug>}` — invokes another process inline; renders as a collapsible subprocess node on the graph; that process runs to completion before the parent continues
- `status`: Design lifecycle of the process definition itself. `active` means the process is in use; `defined` means fully specified but not yet in active use.

**Required body sections:**

```markdown
[One paragraph: what this process does and what a successful run produces.]

## Steps
[Prose description of the flow — what each step does, any branching conditions, human decision points. The frontmatter steps list is the structural reference; this section provides context.]

## Open Questions
[Unresolved design questions. Remove when resolved.]
```

### Process step file format (`wiki/process-steps/<slug>.md`)

```yaml
---
schema_version: "0.1"
id: <slug>
name: <Human-readable name>
actor: user | system | human
architecture:           # typed interactions with architecture objects
  - {object: <arch-slug>, interaction: reads_from | writes_to | calls}
processes: []           # reverse link — which process slugs include this step
status: draft | defined | runnable | deprecated
notes: ""
---
```

**Field semantics:**

- `actor`: Who performs this step.
  - `user` — an external user (reader, editor acting on behalf of a user request)
  - `system` — automated software execution, no human required
  - `human` — internal human actor (editorial team, Tim) performing a manual action
- `architecture`: Typed interactions with architecture objects. Interaction types reuse the existing architecture object relationship vocabulary:
  - `reads_from` — this step reads data from the object
  - `writes_to` — this step writes or mutates data in the object
  - `calls` — this step invokes the object's interface (e.g., calls an MCP server tool, invokes a pipeline)
- `processes`: Reverse link — populated when a process includes this step. Maintained manually at session close (same pattern as `architecture: []` on capability nodes).
- `status`: `runnable` means all referenced architecture objects are at `status: built` or higher. `defined` means the step is fully specified but its architecture prerequisites are not yet built.

**Required body sections:**

```markdown
[One paragraph: what this step does, who performs it, and what it produces or mutates.]

## Open Questions
[Unresolved design questions. Remove when resolved.]
```

### Reverse links added to existing artifact types

**Capability nodes (`wiki/business/capabilities/<slug>.md`):**

Add optional `processes: []` field to frontmatter (same pattern as existing `architecture: []` field):
```yaml
processes: []   # OPTIONAL — process slugs that fulfill this capability; omit when none defined
```

**Architecture objects (`wiki/architecture/<slug>.md`):**

Add optional `process_steps: []` field to frontmatter:
```yaml
process_steps: []   # OPTIONAL — process step slugs that interact with this object; omit when none defined
```

### wiki-interface.md changes (v0.3)

- Section 7 (Operations Node Format) — replaced with **Section 7: Process Format**
- New **Section 8: Process Step Format** (current Section 8 Causal Goal Node Format shifts to Section 9, etc.)
- Section 6 (Capability Node Format) — `processes: []` field added to frontmatter schema
- Section 10 (Architecture Object Format) — `process_steps: []` field added to frontmatter schema
- Version bump: 0.2 → 0.3

### Operations deprecation

**Files removed:**
```
wiki/business/operations/session-workflow.md
wiki/business/operations/session-start.md
wiki/business/operations/session-close.md
wiki/business/operations/session-types.md
wiki/business/operations/content-intake.md
```

**Files updated:**
- `wiki/business/tree-model.md` — Layer 5 renamed from "Operations nodes" to "Processes"; directory updated from `wiki/business/operations/` to `wiki/processes/` and `wiki/process-steps/`; "what belongs where" table updated; key relationships diagram updated
- `wiki/business/capabilities/wiki.md` — `wiki-operations-tree` removed from sub-capabilities list; `wiki-process-layer` added
- `wiki/business/capabilities/wiki-operations-tree.md` — `status` set to `deprecated`; new `wiki-process-layer.md` capability node created
- `wiki/skills/wiki-ops-map-as-is.md` — marked deprecated in frontmatter; body updated with pointer to process layer
- `wiki/catalog/noplasticnoproblem-business-intelligence-dashboard/index.md` — Operations tab reference updated to Processes tab

**ADR written:**
`wiki/adr/2026-04-10-process-layer-replaces-operations.md` — supersedes `2026-04-04-operations-tree-third-tree-type.md`. Records rationale: process layer captures both system flows and human-in-the-loop steps in a unified model; operations tree predated architecture objects layer and lacked the structural relationships needed to be useful; step-as-node model enables cross-process composability that operations tree could not represent.

### New capability node

`wiki/business/capabilities/wiki-process-layer.md`:
```yaml
node: wiki-process-layer
parent: wiki
status: not-started
depends_on: [wiki-bi-dashboard]
```
Covers: process and process-step artifact schemas, dashboard Processes tab, `wiki-add-process` and `wiki-add-process-step` skills (future work), reverse link wiring on capabilities and architecture objects.

---

## Part 2: BI Dashboard — Unified Graph

### Tab change

- **Operations tab** → **Processes tab** (renamed)
- `OperationsDAG.tsx` — deleted
- `ProcessGraph.tsx` — new component (Processes tab primary view)
- `ArchitectureGraph.tsx` — extended with process step node types, cross-layer edges, and process filter controls

### Unified graph concept

The Architecture tab graph and the Processes tab graph share the same node/edge data. Both use the same FloatingEdge approach established in the architecture tab implementation. The difference is default visibility:

| Layer | Architecture tab default | Processes tab default |
|---|---|---|
| Architecture objects | visible | hidden |
| Implementation steps | visible | hidden |
| Process steps | hidden | visible |
| Sequence edges | hidden | visible |
| Step→Arch bridge edges | hidden | optional |

Users can override any default via the filter/control panel.

### New node types

**Process step node (`process-step`):**
- Rectangle with left-side actor stripe: blue = system, green = user, amber = human
- Displays: step name, actor label, runnable indicator
- Runnable indicator: green dot if all referenced architecture objects are `status: built`; amber dot if any are not built; gray dot if no architecture links defined
- Selected state: indigo ring (same as arch tab)
- Click → step detail panel (see below)

**Subprocess node (`subprocess`):**
- Rounded rectangle, distinct visual treatment from step node
- Displays: process name with "↳ subprocess" label
- Click → expands to show that process's step nodes inline (collapsed by default)
- Collapsed state shows process name + step count badge

### New edge types

**Sequence edge:**
- Solid directed arrow between consecutive steps within a process
- LR orientation (left-to-right flow)
- FloatingEdge (nearest border point routing)
- Color: slate gray

**Step→Arch bridge edge:**
- Dashed directed arrow from a process step node to an architecture object node
- Color by interaction type:
  - `reads_from` — blue
  - `writes_to` — orange
  - `calls` — purple
- FloatingEdge
- Toggleable independently from sequence edges

### Layout

- Process step nodes are laid out using dagre in LR direction (sequential flow reads left-to-right)
- Architecture object nodes retain existing TB/LR dagre with `part_of` visual nesting
- When both layers are visible simultaneously, dagre treats them as a combined graph — process step cluster and architecture cluster as distinct node groups with bridge edges crossing between them
- `part_of` nesting on architecture objects is preserved when arch layer is visible

### Filter/control panel

Extended from the existing Architecture tab toggle bar:

**Layer toggles (show/hide node types):**
- `Process steps` — show/hide all process step nodes
- `Architecture objects` — show/hide all architecture object nodes
- `Implementation steps` — show/hide all implementation step nodes

**Edge type toggles:**
- `Sequence` — process step sequence edges
- `Step → Arch` — bridge edges from steps to architecture objects
- `Requires` — existing architecture requires edges
- `Data flow` — existing reads/writes/calls architecture edges

**Process selector:**
- Multi-select dropdown: show steps for all processes, selected processes, or a single process
- Default: all processes
- Selecting a specific process highlights that process's steps; other steps are dimmed but not hidden (to preserve shared step visibility)

### Detail panels

**Process step detail panel (on step node click):**
- Step name and actor
- Runnable status with explanation ("Runnable — all architecture prerequisites built" / "Not runnable — missing: [arch object names]")
- Architecture interactions list (object name + interaction type + object status)
- Processes that include this step (reverse link — shows shared step membership)
- Step body text (first paragraph from step file)
- If not runnable: links to implementation steps that would build the missing architecture objects

**Process detail (on subprocess node click, collapsed state):**
- Process name, trigger type, capabilities fulfilled
- Step count and runnable step count ("3 of 5 steps runnable")

### New loaders

`lib/loadProcesses.ts` — reads `wiki/processes/*.md`, parses frontmatter and step list
`lib/loadProcessSteps.ts` — reads `wiki/process-steps/*.md`, parses frontmatter and architecture links

Both follow the same pattern as existing `loadArchitectureObjects.ts` and `loadImplementationSteps.ts`.

### New types (`lib/types.ts` additions)

```typescript
interface ProcessStep {
  id: string;
  name: string;
  actor: 'user' | 'system' | 'human';
  architecture: Array<{ object: string; interaction: 'reads_from' | 'writes_to' | 'calls' }>;
  processes: string[];
  status: 'draft' | 'defined' | 'runnable' | 'deprecated';
  notes: string;
  body: string;
}

interface ProcessStepRef {
  type: 'step';
  ref: string;
}

interface SubprocessRef {
  type: 'subprocess';
  ref: string;
}

interface Process {
  id: string;
  name: string;
  trigger: 'user-action' | 'schedule' | 'event' | 'subprocess';
  capabilities: string[];
  steps: Array<ProcessStepRef | SubprocessRef>;
  status: 'draft' | 'defined' | 'active' | 'deprecated';
  notes: string;
  body: string;
}
```

---

## Scope (this implementation step)

**In scope:**
- Wiki schema: process and process-step frontmatter formats, wiki-interface.md v0.3, tree-model.md update, capability node changes, operations deprecation and file removal, ADR
- Dashboard: ProcessGraph.tsx (Processes tab), ArchitectureGraph.tsx extensions (new node types, edge types, filter panel), new loaders and types, Operations tab removal

**Out of scope (follow-up implementation step):**
- `wiki-add-process` and `wiki-add-process-step` skills — authoring tools for the new artifact types
- Post-implementation scope review pass — audit capabilities and architecture objects for content that belongs in process definitions
- `wiki-process-scope-review` implementation step (created after this step is marked done)
- Trigger model expansion beyond the current four-value enum
- Per-step visibility controls beyond the process selector (deferred — start with per-process granularity)

---

## Definition of Done

**Wiki:**
- `wiki/processes/` directory exists (may be empty or contain at least one example process)
- `wiki/process-steps/` directory exists (may be empty or contain at least one example step)
- `wiki-interface.md` updated to v0.3 with process and process-step schemas
- `tree-model.md` updated: Layer 5 is Processes, not Operations
- Operations files removed (5 files)
- `wiki-operations-tree` capability marked deprecated
- `wiki-process-layer` capability node created
- ADR written superseding the operations tree ADR
- `wiki.md` sub-capabilities updated
- Reverse link fields (`processes: []`, `process_steps: []`) documented in wiki-interface.md

**Dashboard:**
- `OperationsDAG.tsx` deleted
- `ProcessGraph.tsx` renders process step nodes with actor stripe, runnable indicator, sequence edges
- `ArchitectureGraph.tsx` renders process step nodes when process layer is visible, with bridge edges to arch objects
- Filter panel includes layer toggles and process selector
- Step detail panel shows architecture interactions and runnable status
- New loaders (`loadProcesses.ts`, `loadProcessSteps.ts`) functional
- New types added to `lib/types.ts`
- Operations tab removed from `Dashboard.tsx`, Processes tab added
