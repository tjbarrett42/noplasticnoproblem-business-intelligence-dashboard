'use client';

import React, { useMemo } from 'react';
import type { GoalNode } from '@/lib/types';

interface TreeNode extends GoalNode {
  children: TreeNode[];
}

interface Props {
  goals: GoalNode[];
  selectedGoal: string | null;
  onSelectGoal: (node: string | null) => void;
  highlightedGoals: Set<string>; // highlighted because a capability was selected
  onCapabilityClick: (slug: string) => void;
  onOpenInTab: (slug: string, label: string) => void;
}

function buildTree(goals: GoalNode[]): TreeNode | null {
  const map = new Map<string, TreeNode>();
  goals.forEach((g) => map.set(g.node, { ...g, children: [] }));
  let root: TreeNode | null = null;
  goals.forEach((g) => {
    if (!g.parent) {
      root = map.get(g.node) ?? null;
    } else {
      const parent = map.get(g.parent);
      if (parent) parent.children.push(map.get(g.node)!);
    }
  });
  return root;
}

function goalStatusColor(status: GoalNode['status'], isHighlighted: boolean): string {
  if (isHighlighted) return 'ring-2 ring-violet-400';
  return '';
}

function goalStatusBadge(status: GoalNode['status']): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-100 text-green-800';
    case 'underperforming':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function goalCardBg(status: GoalNode['status']): string {
  switch (status) {
    case 'healthy':
      return 'border-green-300 bg-green-50';
    case 'underperforming':
      return 'border-orange-300 bg-orange-50';
    default:
      return 'border-gray-300 bg-white';
  }
}

function MeasuredIndicator({ measured }: { measured: GoalNode['measured'] }) {
  if (measured === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        🔒 blocked
      </span>
    );
  }
  if (measured === true) {
    return <span className="inline-flex items-center gap-1 text-xs text-green-600">✓ measured</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-gray-400">unmeasured</span>;
}

function NodeCard({
  node,
  selectedGoal,
  onSelect,
  isHighlighted,
  onCapabilityClick,
}: {
  node: TreeNode;
  selectedGoal: string | null;
  onSelect: (n: string | null) => void;
  isHighlighted: boolean;
  onCapabilityClick: (slug: string) => void;
}) {
  const isSelected = selectedGoal === node.node;
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className={`
          relative cursor-pointer rounded-lg border-2 p-3 w-52 transition-all
          ${goalCardBg(node.status)}
          ${isHighlighted ? 'ring-2 ring-violet-400 ring-offset-1' : ''}
          ${isSelected ? 'shadow-lg shadow-blue-100 border-blue-400' : 'hover:shadow-md'}
        `}
        onClick={() => onSelect(isSelected ? null : node.node)}
      >
        <div className="font-semibold text-sm text-gray-800 mb-1 leading-tight">
          {node.node}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${goalStatusBadge(node.status)}`}>
            {node.status}
          </span>
          <MeasuredIndicator measured={node.measured} />
        </div>
        {node.current_value && (
          <div className="mt-1.5 text-xs text-gray-600 truncate" title={node.current_value}>
            {node.current_value}
          </div>
        )}

        {/* Inline detail when selected */}
        {isSelected && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-2">
            {node.depends_on.length > 0 && (
              <div>
                <span className="font-medium text-gray-500">blocked by:</span>{' '}
                <span className="text-gray-700">{node.depends_on.join(', ')}</span>
              </div>
            )}
            {node.requires_capabilities.length > 0 && (
              <div>
                <div className="font-medium text-gray-500 mb-1">requires capabilities:</div>
                <div className="flex flex-wrap gap-1">
                  {node.requires_capabilities.map((cap) => (
                    <button
                      key={cap}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCapabilityClick(cap);
                      }}
                      className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-medium"
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {node.horizon && (
              <div>
                <span className="font-medium text-gray-500">horizon:</span>{' '}
                <span className="text-gray-700">{node.horizon}</span>
                {node.confidence && (
                  <span className="ml-2 text-gray-500">· confidence: {node.confidence}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && (
        <>
          {/* Vertical connector from this card */}
          <div className="w-px h-5 bg-gray-300" />
          {/* Horizontal bar spanning children */}
          {node.children.length > 1 && (
            <div className="relative flex items-start">
              <div className="absolute top-0 left-0 right-0 h-px bg-gray-300" style={{ width: '100%' }} />
            </div>
          )}
          <div className="flex gap-4 items-start relative">
            {/* Horizontal connector line across children */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 bg-gray-300"
                style={{
                  height: '1px',
                  left: '50%',
                  width: `calc(100% - ${(100 / node.children.length)}%)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {node.children.map((child) => (
              <div key={child.node} className="flex flex-col items-center">
                {/* Vertical drop to child */}
                <div className="w-px h-5 bg-gray-300" />
                <NodeCard
                  node={child}
                  selectedGoal={selectedGoal}
                  onSelect={onSelect}
                  isHighlighted={false}
                  onCapabilityClick={onCapabilityClick}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CausalTree({
  goals,
  selectedGoal,
  onSelectGoal,
  highlightedGoals,
  onCapabilityClick,
  onOpenInTab,
}: Props) {
  const tree = useMemo(() => buildTree(goals), [goals]);

  if (!tree) {
    return <div className="text-gray-500 p-8">No goal data found.</div>;
  }

  // Find selected node for detail panel
  const selected = selectedGoal ? goals.find((g) => g.node === selectedGoal) : null;

  return (
    <div className="flex gap-6 h-full">
      {/* Tree */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col items-center min-w-max">
          <NodeCard
            node={tree}
            selectedGoal={selectedGoal}
            onSelect={onSelectGoal}
            isHighlighted={highlightedGoals.has(tree.node)}
            onCapabilityClick={onCapabilityClick}
          />
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-gray-200 overflow-auto">
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-lg text-gray-900">{selected.node}</h2>
              <button
                onClick={() => onSelectGoal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <span className={`text-xs px-2 py-1 rounded font-medium ${goalStatusBadge(selected.status)}`}>
              {selected.status}
            </span>

            {selected.current_value && (
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current value</div>
                <div className="text-sm text-gray-800 mt-0.5">{selected.current_value}</div>
              </div>
            )}

            <div className="mt-3 flex gap-3 text-xs text-gray-500">
              <MeasuredIndicator measured={selected.measured} />
              {selected.horizon && <span>horizon: {selected.horizon}</span>}
              {selected.confidence && <span>confidence: {selected.confidence}</span>}
            </div>

            {selected.depends_on.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Blocked by
                </div>
                {selected.depends_on.map((d) => (
                  <div key={d} className="text-sm text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1">
                    {d}
                  </div>
                ))}
              </div>
            )}

            {selected.requires_capabilities.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Requires capabilities
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.requires_capabilities.map((cap) => (
                    <div key={cap} className="flex items-center gap-0.5">
                      <button
                        onClick={() => onCapabilityClick(cap)}
                        className="px-2 py-1 rounded-l bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200 transition-colors"
                      >
                        → {cap}
                      </button>
                      <button
                        onClick={() => onOpenInTab(cap, cap)}
                        className="px-1.5 py-1 rounded-r bg-violet-50 text-violet-500 text-xs hover:bg-violet-100 transition-colors border-l border-violet-200"
                        title="Open in new tab"
                      >
                        ↗
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.system.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">System</div>
                <div className="text-xs text-gray-600">{selected.system.join(', ')}</div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">About</div>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">{selected.body.split('\n\n')[0]}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
