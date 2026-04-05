export type GoalStatus = 'healthy' | 'underperforming' | 'unknown';
export type CapabilityStatus = 'not-started' | 'partial' | 'built' | 'operational';

export interface GoalNode {
  slug: string;
  node: string;
  parent: string | null;
  current_value: string | null;
  data_ref: string | null;
  system: string[];
  measured: boolean | 'blocked';
  depends_on: string[];
  horizon: string | null;
  confidence: string | null;
  status: GoalStatus;
  requires_capabilities: string[];
  body: string;
}

export interface CapabilityNode {
  slug: string;
  node: string;
  parent: string | null; // null = root, 'unplaced' = orphan, slug = child
  status: CapabilityStatus;
  global_blocker: boolean;
  depends_on: string[];
  unlocks: string[];
  enables: string[];
  system: string[];
  measured: boolean;
  notes: string;
  body: string;
}
