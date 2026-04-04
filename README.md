# noplasticnoproblem Business Intelligence Dashboard

Visualizes the two-tree business model: causal goal tree + capability DAG.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data source

Reads directly from `../noplasticnoproblem-wiki/wiki/business/` at startup. No database or API required.

To use a different wiki path, copy `.env.example` to `.env.local` and set `WIKI_PATH`.

## Tabs

- **Tab 1 — Goals**: Causal tree showing revenue drivers. Nodes colored by status. Click a node to see its detail and required capabilities. Capability links switch to Tab 2.
- **Tab 2 — Capabilities**: DAG of all 25 capability nodes. Colored by build status. "Unblocked" filter shows capabilities ready to start. Click a node to see its detail and causal connections.
