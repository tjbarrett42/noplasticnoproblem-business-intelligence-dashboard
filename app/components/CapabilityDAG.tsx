'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { CapabilityNode } from '@/lib/types';

interface Props {
  capabilities: CapabilityNode[];
  selectedCapability: string | null;
  onSelectCapability: (slug: string | null) => void;
  highlightedCapabilities: Set<string>;
  onGoalClick: (node: string) => void;
  showUnblockedOnly: boolean;
}

const NODE_W = 190;
const NODE_H = 72;

function statusColors(status: CapabilityNode['status']) {
  switch (status) {
    case 'operational':
      return { bg: '#dcfce7', border: '#16a34a', text: '#15803d', badge: 'bg-green-100 text-green-800' };
    case 'built':
      return { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8', badge: 'bg-blue-100 text-blue-800' };
    case 'partial':
      return { bg: '#fef9c3', border: '#ca8a04', text: '#92400e', badge: 'bg-yellow-100 text-yellow-800' };
    default:
      return { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', badge: 'bg-gray-100 text-gray-600' };
  }
}

// Custom node component
function CapNode({
  data,
}: {
  data: {
    label: string;
    status: CapabilityNode['status'];
    isSelected: boolean;
    isHighlighted: boolean;
    isUnblocked: boolean;
    onClick: () => void;
  };
}) {
  const colors = statusColors(data.status);
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <div
        onClick={data.onClick}
        className="cursor-pointer rounded-lg border-2 transition-all"
        style={{
          width: NODE_W,
          minHeight: NODE_H,
          background: data.isHighlighted ? '#ede9fe' : colors.bg,
          borderColor: data.isSelected ? '#7c3aed' : data.isHighlighted ? '#8b5cf6' : colors.border,
          boxShadow: data.isSelected ? '0 0 0 3px #c4b5fd' : undefined,
          padding: '10px 12px',
        }}
      >
        <div className="font-semibold text-xs leading-tight text-gray-800 mb-1.5">
          {data.label}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {data.status}
          </span>
          {data.isUnblocked && (
            <span className="text-xs px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              ready
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </>
  );
}

const nodeTypes: NodeTypes = { cap: CapNode };

function buildLayout(
  capabilities: CapabilityNode[],
  selectedCapability: string | null,
  highlightedCapabilities: Set<string>,
  showUnblockedOnly: boolean,
  onSelectCapability: (slug: string | null) => void
): { nodes: Node[]; edges: Edge[] } {
  const visibleCaps = showUnblockedOnly
    ? capabilities.filter((c) => isUnblocked(c, capabilities))
    : capabilities;

  const visibleSlugs = new Set(visibleCaps.map((c) => c.slug));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 60 });

  visibleCaps.forEach((c) => {
    g.setNode(c.slug, { width: NODE_W, height: NODE_H });
  });

  visibleCaps.forEach((c) => {
    c.depends_on.forEach((dep) => {
      if (visibleSlugs.has(dep)) {
        g.setEdge(dep, c.slug);
      }
    });
  });

  dagre.layout(g);

  const nodes: Node[] = visibleCaps.map((c) => {
    const { x, y } = g.node(c.slug);
    const unblocked = isUnblocked(c, capabilities);
    return {
      id: c.slug,
      type: 'cap',
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      data: {
        label: c.node,
        status: c.status,
        isSelected: selectedCapability === c.slug,
        isHighlighted: highlightedCapabilities.has(c.slug),
        isUnblocked: unblocked,
        onClick: () => onSelectCapability(selectedCapability === c.slug ? null : c.slug),
      },
    };
  });

  const edges: Edge[] = [];
  visibleCaps.forEach((c) => {
    c.depends_on.forEach((dep) => {
      if (visibleSlugs.has(dep)) {
        const isHighlight =
          (selectedCapability === c.slug || selectedCapability === dep) ||
          (highlightedCapabilities.has(c.slug) || highlightedCapabilities.has(dep));
        edges.push({
          id: `${dep}->${c.slug}`,
          source: dep,
          target: c.slug,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: isHighlight ? '#7c3aed' : '#d1d5db', strokeWidth: isHighlight ? 2 : 1 },
          animated: isHighlight,
        });
      }
    });
  });

  return { nodes, edges };
}

function isUnblocked(cap: CapabilityNode, all: CapabilityNode[]): boolean {
  if (cap.depends_on.length === 0) return true;
  const statusMap = new Map(all.map((c) => [c.slug, c.status]));
  return cap.depends_on.every((dep) => {
    const s = statusMap.get(dep);
    return s === 'built' || s === 'operational';
  });
}

function capStatusBadgeClass(status: CapabilityNode['status']): string {
  return statusColors(status).badge;
}

export default function CapabilityDAG({
  capabilities,
  selectedCapability,
  onSelectCapability,
  highlightedCapabilities,
  onGoalClick,
  showUnblockedOnly,
}: Props) {
  const selected = selectedCapability
    ? capabilities.find((c) => c.slug === selectedCapability)
    : null;

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () =>
      buildLayout(
        capabilities,
        selectedCapability,
        highlightedCapabilities,
        showUnblockedOnly,
        onSelectCapability
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capabilities, selectedCapability, highlightedCapabilities, showUnblockedOnly]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <div className="flex gap-0 h-full">
      {/* DAG canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-gray-200 overflow-auto">
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-lg text-gray-900">{selected.node}</h2>
              <button
                onClick={() => onSelectCapability(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <span
              className={`text-xs px-2 py-1 rounded font-medium ${capStatusBadgeClass(selected.status)}`}
            >
              {selected.status}
            </span>

            {selected.parent && (
              <div className="mt-3 text-xs text-gray-500">
                parent: <span className="text-gray-700 font-medium">{selected.parent}</span>
              </div>
            )}

            {selected.notes && (
              <div className="mt-3 text-xs text-gray-600 italic bg-gray-50 rounded p-2">
                {selected.notes}
              </div>
            )}

            {selected.unlocks.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Unlocks (causal nodes)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.unlocks.map((g) => (
                    <button
                      key={g}
                      onClick={() => onGoalClick(g)}
                      className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      ↑ {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.depends_on.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Blocked by
                </div>
                {selected.depends_on.map((d) => {
                  const dep = capabilities.find((c) => c.slug === d);
                  return (
                    <button
                      key={d}
                      onClick={() => onSelectCapability(d)}
                      className="block w-full text-left text-sm text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1 hover:bg-amber-100 transition-colors"
                    >
                      {d}
                      {dep && (
                        <span className="ml-2 text-xs opacity-70">({dep.status})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selected.enables.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Enables
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.enables.map((e) => (
                    <button
                      key={e}
                      onClick={() => onSelectCapability(e)}
                      className="px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-200 text-xs font-medium hover:bg-violet-100 transition-colors"
                    >
                      {e} →
                    </button>
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
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-8">
                {selected.body.split('\n\n')[0]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
