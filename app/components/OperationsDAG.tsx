'use client';

import React, { useEffect, useMemo } from 'react';
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
import type { OperationNode } from '@/lib/types';

interface Props {
  operations: OperationNode[];
  selectedOperation: string | null;
  onSelectOperation: (slug: string | null) => void;
  onCapabilityClick: (slug: string) => void;
}

const NODE_W = 210;
const NODE_H = 80;

function statusColors(status: OperationNode['status']) {
  switch (status) {
    case 'operational':
      return { bg: '#ccfbf1', border: '#0d9488', text: '#0f766e', badge: 'bg-teal-100 text-teal-800' };
    case 'built':
      return { bg: '#cffafe', border: '#0891b2', text: '#0e7490', badge: 'bg-cyan-100 text-cyan-800' };
    case 'partial':
      return { bg: '#fef9c3', border: '#ca8a04', text: '#92400e', badge: 'bg-yellow-100 text-yellow-800' };
    default:
      return { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', badge: 'bg-gray-100 text-gray-600' };
  }
}

function typeIcon(type: OperationNode['type']) {
  switch (type) {
    case 'decision': return '⬡';
    case 'trigger':  return '⚡';
    default:         return '▶';
  }
}

function OpNode({
  data,
}: {
  data: {
    label: string;
    status: OperationNode['status'];
    type: OperationNode['type'];
    skillCount: number;
    isSelected: boolean;
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
          background: colors.bg,
          borderColor: data.isSelected ? '#0d9488' : colors.border,
          boxShadow: data.isSelected ? '0 0 0 3px #99f6e4' : undefined,
          padding: '10px 12px',
        }}
      >
        <div className="font-semibold text-xs leading-tight text-gray-800 mb-1.5">
          {data.label}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {data.status}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
            {typeIcon(data.type)} {data.type}
          </span>
          {data.skillCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
              {data.skillCount} skill{data.skillCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </>
  );
}

const nodeTypes: NodeTypes = { op: OpNode };

function buildLayout(
  placedOps: OperationNode[],
  selectedOperation: string | null,
  onSelectOperation: (slug: string | null) => void
): { nodes: Node[]; edges: Edge[] } {
  const visibleSlugs = new Set(placedOps.map((o) => o.slug));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 60 });

  placedOps.forEach((o) => g.setNode(o.slug, { width: NODE_W, height: NODE_H }));
  placedOps.forEach((o) => {
    if (o.parent && o.parent !== 'unplaced' && visibleSlugs.has(o.parent)) {
      g.setEdge(o.parent, o.slug);
    }
  });

  dagre.layout(g);

  const nodes: Node[] = placedOps.map((o) => {
    const { x, y } = g.node(o.slug);
    return {
      id: o.slug,
      type: 'op',
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      data: {
        label: o.node,
        status: o.status,
        type: o.type,
        skillCount: o.skills.length,
        isSelected: selectedOperation === o.slug,
        onClick: () => onSelectOperation(selectedOperation === o.slug ? null : o.slug),
      },
    };
  });

  const edges: Edge[] = [];
  placedOps.forEach((o) => {
    if (o.parent && o.parent !== 'unplaced' && visibleSlugs.has(o.parent)) {
      const isHighlight = selectedOperation === o.slug || selectedOperation === o.parent;
      edges.push({
        id: `parent:${o.parent}->${o.slug}`,
        source: o.parent,
        target: o.slug,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: isHighlight ? '#0d9488' : '#d1d5db',
          strokeWidth: isHighlight ? 2 : 1,
          strokeDasharray: '5 4',
        },
        animated: isHighlight,
      });
    }
  });

  return { nodes, edges };
}

export default function OperationsDAG({
  operations,
  selectedOperation,
  onSelectOperation,
  onCapabilityClick,
}: Props) {
  const placedOps = useMemo(
    () => operations.filter((o) => o.parent !== 'unplaced'),
    [operations]
  );
  const unplacedOps = useMemo(
    () => operations.filter((o) => o.parent === 'unplaced'),
    [operations]
  );

  const selected = selectedOperation
    ? operations.find((o) => o.slug === selectedOperation)
    : null;

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildLayout(placedOps, selectedOperation, onSelectOperation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placedOps, selectedOperation]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <div className="flex gap-0 h-full">
      {/* Left: DAG canvas + unplaced tray */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1">
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

        {unplacedOps.length > 0 && (
          <div className="shrink-0 border-t border-dashed border-gray-300 bg-white px-4 py-2.5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Unplaced</div>
            <div className="flex flex-wrap gap-2">
              {unplacedOps.map((op) => {
                const colors = statusColors(op.status);
                return (
                  <button
                    key={op.slug}
                    onClick={() => onSelectOperation(selectedOperation === op.slug ? null : op.slug)}
                    className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                      selectedOperation === op.slug
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {op.node}
                    <span className={`ml-1.5 text-xs px-1 py-0.5 rounded ${colors.badge}`}>
                      {op.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-gray-200 overflow-auto">
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-lg text-gray-900">{selected.node}</h2>
              <button
                onClick={() => onSelectOperation(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded font-medium ${statusColors(selected.status).badge}`}>
                {selected.status}
              </span>
              <span className="text-xs px-2 py-1 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                {typeIcon(selected.type)} {selected.type}
              </span>
            </div>

            {selected.parent && selected.parent !== 'unplaced' && (
              <div className="mt-3 text-xs text-gray-500">
                parent:{' '}
                <button
                  onClick={() => onSelectOperation(selected.parent as string)}
                  className="text-gray-700 font-medium hover:underline"
                >
                  {selected.parent}
                </button>
              </div>
            )}
            {selected.parent === 'unplaced' && (
              <div className="mt-3 text-xs text-gray-400 italic">unplaced — position in tree TBD</div>
            )}

            {selected.skills.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium"
                    >
                      /{s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selected.skills.length === 0 && (
              <div className="mt-4 text-xs text-gray-400 italic">No skills — process is informal or implemented outside skill library.</div>
            )}

            {selected.requires.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Requires (capabilities)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.requires.map((r) => (
                    <button
                      key={r}
                      onClick={() => onCapabilityClick(r)}
                      className="px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-200 text-xs font-medium hover:bg-violet-100 transition-colors"
                    >
                      {r} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.outputs.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Outputs
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.outputs.map((o) => (
                    <span
                      key={o}
                      className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="mt-3 text-xs text-gray-600 italic bg-gray-50 rounded p-2">
                {selected.notes}
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
