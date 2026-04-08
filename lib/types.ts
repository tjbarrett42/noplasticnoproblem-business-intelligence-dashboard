export type GoalStatus = 'healthy' | 'underperforming' | 'unknown';
export type CapabilityStatus = 'not-started' | 'partial' | 'built' | 'operational';
export type OperationStatus = 'not-started' | 'partial' | 'built' | 'operational';
export type OperationType = 'process' | 'decision' | 'trigger';

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
  focus: boolean;
  body: string;
}

export interface CapabilityNode {
  slug: string;
  node: string;
  parent: string | string[] | null; // null = root, 'unplaced' = orphan, slug = child, string[] = multi-parent
  status: CapabilityStatus;
  global_blocker: boolean;
  focus: boolean;
  depends_on: string[];
  unlocks: string[];
  enables: string[];
  system: string[];
  measured: boolean;
  notes: string;
  body: string;
}

export interface OperationNode {
  slug: string;
  node: string;
  type: OperationType;
  parent: string | null; // null = root, 'unplaced' = orphan, slug = child
  status: OperationStatus;
  requires: string[];   // capability slugs
  skills: string[];     // wiki- skill names
  outputs: string[];
  notes: string;
  body: string;
}
