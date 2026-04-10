'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import {
  Database,
  FileText,
  Server,
  Workflow,
  Layers,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import type { ArchitectureObject, ImplementationStep, ArchObjectType, ArchObjectStatus, StepStatus } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ARCH_NODE_W = 210;
const ARCH_NODE_H = 78;

const TYPE_ICONS: Record<ArchObjectType, LucideIcon> = {
  'data-store': Database,
  schema: FileText,
  service: Server,
  pipeline: Workflow,
  interface: Layers,
  library: Package,
  config: Settings,
};

const STATUS_STYLES: Record<
  ArchObjectStatus,
  { bg: string; border: string; badge: string }
> = {
  proposed: { bg: '#f3f4f6', border: '#d1d5db', badge: 'bg-gray-100 text-gray-600' },
  accepted: { bg: '#eff6ff', border: '#60a5fa', badge: 'bg-blue-100 text-blue-800' },
  built:    { bg: '#f0fdf4', border: '#4ade80', badge: 'bg-green-100 text-green-800' },
  deprecated: { bg: '#f9fafb', border: '#e5e7eb', badge: 'bg-gray-50 text-gray-400' },
};

const STEP_STATUS_STYLES: Record<StepStatus, { dot: string; badge: string }> = {
  ready:       { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800' },
  blocked:     { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800' },
  'in-progress': { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
  done:        { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-800' },
  abandoned:   { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500' },
};

// ─── ArchNode custom ReactFlow node ──────────────────────────────────────────

type ArchNodeData = {
  object: ArchitectureObject;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
};

function ArchNode({ data }: { data: ArchNodeData }) {
  const { object, isSelected, isHighlighted, onClick } = data;
  const styles = STATUS_STYLES[object.status];
  const Icon = TYPE_ICONS[object.type];
  const hasBlockers = object.blockers.length > 0;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <div
        onClick={onClick}
        className="cursor-pointer rounded-lg border-2 transition-all relative overflow-hidden"
        style={{
          width: ARCH_NODE_W,
          minHeight: ARCH_NODE_H,
          background: isHighlighted ? '#fff7ed' : styles.bg,
          borderColor: isSelected
            ? '#6366f1'
            : isHighlighted
            ? '#fb923c'
            : hasBlockers
            ? '#f97316'
            : styles.border,
          boxShadow: isSelected
            ? '0 0 0 3px #c7d2fe'
            : isHighlighted
            ? '0 0 0 2px #fed7aa'
            : undefined,
          padding: '8px 10px 8px 14px',
        }}
      >
        {/* Orange left stripe for blockers */}
        {hasBlockers && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-orange-400 rounded-l"
            style={{ width: 3 }}
          />
        )}
        {/* Type row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Icon size={12} />
            <span>{object.type}</span>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles.badge}`}>
            {object.status}
          </span>
        </div>
        {/* Node name */}
        <div className="font-semibold text-xs text-gray-800 leading-tight">{object.node}</div>
        {/* Blocker count */}
        {hasBlockers && (
          <div className="mt-1 text-xs text-orange-600 font-medium">
            ⚠ {object.blockers.length} blocker{object.blockers.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </>
  );
}

const archNodeTypes: NodeTypes = { arch: ArchNode };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStepName(id: string): string {
  return id.replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, '').replace(/-/g, ' ');
}

// ─── buildArchLayout ──────────────────────────────────────────────────────────

function buildArchLayout(
  objects: ArchitectureObject[],
  selectedSlug: string | null,
  highlightedSlugs: Set<string>,
  showRequires: boolean,
  showDataFlow: boolean,
  onSelectNode: (slug: string | null) => void,
): { nodes: Node[]; edges: Edge[] } {
  const slugSet = new Set(objects.map((o) => o.slug));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 70 });

  objects.forEach((o) => g.setNode(o.slug, { width: ARCH_NODE_W, height: ARCH_NODE_H }));

  // Add requires edges to dagre for layout (regardless of toggle — drives rank ordering)
  objects.forEach((o) => {
    o.requires.forEach((req) => {
      if (slugSet.has(req)) g.setEdge(req, o.slug);
    });
  });

  dagre.layout(g);

  const nodes: Node[] = objects.map((o) => {
    const { x, y } = g.node(o.slug);
    return {
      id: o.slug,
      type: 'arch',
      position: { x: x - ARCH_NODE_W / 2, y: y - ARCH_NODE_H / 2 },
      data: {
        object: o,
        isSelected: selectedSlug === o.slug,
        isHighlighted: highlightedSlugs.has(o.slug),
        onClick: () => onSelectNode(selectedSlug === o.slug ? null : o.slug),
      },
    };
  });

  const edges: Edge[] = [];

  if (showRequires) {
    objects.forEach((o) => {
      o.requires.forEach((req) => {
        if (!slugSet.has(req)) return;
        const isActive = selectedSlug === o.slug || selectedSlug === req
          || highlightedSlugs.has(o.slug) || highlightedSlugs.has(req);
        edges.push({
          id: `req:${req}->${o.slug}`,
          source: req,
          target: o.slug,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: isActive ? '#f97316' : '#9ca3af',
            strokeWidth: isActive ? 2 : 1,
            strokeDasharray: '5 3',
          },
        });
      });
    });
  }

  if (showDataFlow) {
    const dataFlowEdgeDefs: { field: keyof ArchitectureObject; color: string; label: string }[] = [
      { field: 'reads_from', color: '#3b82f6', label: 'reads' },
      { field: 'writes_to',  color: '#22c55e', label: 'writes' },
      { field: 'calls',      color: '#a855f7', label: 'calls' },
    ];
    dataFlowEdgeDefs.forEach(({ field, color, label }) => {
      objects.forEach((o) => {
        const targets = o[field] as string[];
        targets.forEach((target) => {
          if (!slugSet.has(target)) return;
          edges.push({
            id: `${field}:${o.slug}->${target}`,
            source: o.slug,
            target,
            label,
            markerEnd: { type: MarkerType.ArrowClosed, color },
            style: { stroke: color, strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: color },
          });
        });
      });
    });
  }

  return { nodes, edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  archObjects: ArchitectureObject[];
  steps: ImplementationStep[];
}

export default function ArchitectureGraph({ archObjects, steps }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<ImplementationStep | null>(null);
  const [stepListCollapsed, setStepListCollapsed] = useState(false);
  const [showRequires, setShowRequires] = useState(true);
  const [showDataFlow, setShowDataFlow] = useState(false);

  const highlightedSlugs = useMemo(
    () => (selectedStep ? new Set(selectedStep.architecture) : new Set<string>()),
    [selectedStep],
  );

  const selectedObject = selectedSlug
    ? archObjects.find((o) => o.slug === selectedSlug) ?? null
    : null;

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () =>
      buildArchLayout(
        archObjects,
        selectedSlug,
        highlightedSlugs,
        showRequires,
        showDataFlow,
        setSelectedSlug,
      ),
    [archObjects, selectedSlug, highlightedSlugs, showRequires, showDataFlow],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Step list panel ── */}
      <div
        className="shrink-0 border-r border-gray-200 bg-white overflow-hidden transition-all duration-150 flex flex-col"
        style={{ width: stepListCollapsed ? 0 : 200 }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">
            Steps
          </span>
          <button
            onClick={() => setStepListCollapsed(true)}
            className="text-gray-400 hover:text-gray-600 ml-1 shrink-0"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {steps.length === 0 && (
            <div className="px-3 py-4 text-xs text-gray-400">No implementation steps.</div>
          )}
          {steps.map((step) => {
            const ss = STEP_STATUS_STYLES[step.status];
            const isActive = selectedStep?.id === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setSelectedStep(isActive ? null : step)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ss.dot}`} />
                  <span className="text-xs text-gray-700 font-medium leading-tight line-clamp-2">
                    {formatStepName(step.id)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-3.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ss.badge}`}>
                    {step.status}
                  </span>
                  {step.status === 'blocked' && step.blockers.length > 0 && (
                    <span className="text-xs text-orange-500">{step.blockers.length} ▲</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expand step list button when collapsed */}
      {stepListCollapsed && (
        <button
          onClick={() => setStepListCollapsed(false)}
          className="shrink-0 flex items-center justify-center w-6 bg-white border-r border-gray-200 hover:bg-gray-50 transition-colors"
          title="Show implementation steps"
        >
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      )}

      {/* ── Step detail panel ── */}
      {selectedStep && (
        <div className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
          <div className="flex items-start justify-between p-4 border-b border-gray-100 shrink-0">
            <div>
              <div className="text-xs font-semibold text-gray-800 leading-tight mb-1">
                {formatStepName(selectedStep.id)}
              </div>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  STEP_STATUS_STYLES[selectedStep.status].badge
                }`}
              >
                {selectedStep.status}
              </span>
            </div>
            <button
              onClick={() => setSelectedStep(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0"
            >
              ×
            </button>
          </div>
          <div className="p-4 space-y-4 text-xs">
            {selectedStep.blockers.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <div className="font-semibold text-orange-700 mb-1.5 uppercase tracking-wide text-xs">
                  Blockers
                </div>
                <ul className="space-y-1.5">
                  {selectedStep.blockers.map((b, i) => (
                    <li key={i} className="text-orange-800 leading-snug">• {b}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedStep.architecture.length > 0 && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Architecture objects
                </div>
                <div className="space-y-1">
                  {selectedStep.architecture.map((slug) => {
                    const obj = archObjects.find((o) => o.slug === slug);
                    const ss = obj ? STATUS_STYLES[obj.status] : null;
                    return (
                      <button
                        key={slug}
                        onClick={() => setSelectedSlug(selectedSlug === slug ? null : slug)}
                        className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      >
                        {ss && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border"
                            style={{ background: ss.bg, borderColor: ss.border }}
                          />
                        )}
                        <span className="text-gray-700 font-medium">{obj?.node ?? slug}</span>
                        {obj && (
                          <span className={`ml-auto text-xs px-1 py-0.5 rounded ${ss!.badge}`}>
                            {obj.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedStep.capabilities_supported.length > 0 && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Capabilities supported
                </div>
                <div className="text-gray-600">
                  {selectedStep.capabilities_supported.join(', ')}
                </div>
              </div>
            )}
            {selectedStep.artifacts.length > 0 && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Artifacts
                </div>
                <div className="space-y-1">
                  {selectedStep.artifacts.map((a, i) => (
                    <div key={i} className="text-gray-600">
                      <span className="font-medium text-gray-500">{a.type}</span>
                      {a.repo && <span className="text-gray-400"> [{a.repo}]</span>}
                      <div className="font-mono text-xs text-gray-500 break-all">{a.path}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Graph area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Graph toolbar */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRequires}
              onChange={(e) => setShowRequires(e.target.checked)}
              className="rounded"
            />
            Requires edges
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDataFlow}
              onChange={(e) => setShowDataFlow(e.target.checked)}
              className="rounded"
            />
            Data flow edges
          </label>
          {archObjects.length === 0 && (
            <span className="text-xs text-gray-400 ml-2">No architecture objects in wiki/architecture/</span>
          )}
        </div>
        {/* ReactFlow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={archNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            onPaneClick={() => setSelectedSlug(null)}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      {/* ── Node detail panel ── */}
      {selectedObject && (
        <div className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {React.createElement(TYPE_ICONS[selectedObject.type], { size: 14, className: 'text-gray-500 shrink-0 mt-0.5' })}
                <span className="text-xs text-gray-500">{selectedObject.type}</span>
              </div>
              <button
                onClick={() => setSelectedSlug(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0"
              >
                ×
              </button>
            </div>
            <div className="font-bold text-gray-900 text-sm mb-2">{selectedObject.node}</div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[selectedObject.status].badge}`}>
              {selectedObject.status}
            </span>
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* Blockers */}
            {selectedObject.blockers.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <div className="font-semibold text-orange-700 mb-1.5 uppercase tracking-wide text-xs">
                  Blockers
                </div>
                <ul className="space-y-1.5">
                  {selectedObject.blockers.map((b, i) => (
                    <li key={i} className="text-orange-800 leading-snug">• {b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Responsibilities — first paragraph of body */}
            {selectedObject.body && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Responsibilities
                </div>
                <p className="text-gray-600 leading-relaxed">
                  {selectedObject.body.split('\n\n')[0].slice(0, 300)}
                  {selectedObject.body.split('\n\n')[0].length > 300 ? '…' : ''}
                </p>
              </div>
            )}

            {/* Required by — reverse lookup */}
            {(() => {
              const requiredBy = archObjects.filter((o) => o.requires.includes(selectedObject.slug));
              return requiredBy.length > 0 ? (
                <div>
                  <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Required by
                  </div>
                  <div className="space-y-1">
                    {requiredBy.map((o) => (
                      <button
                        key={o.slug}
                        onClick={() => setSelectedSlug(o.slug)}
                        className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-700 font-medium">{o.node}</span>
                        <span className={`ml-auto text-xs px-1 py-0.5 rounded ${STATUS_STYLES[o.status].badge}`}>
                          {o.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Part of */}
            {selectedObject.part_of.length > 0 && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Part of</div>
                <div className="text-gray-600">{selectedObject.part_of.join(', ')}</div>
              </div>
            )}

            {/* Implementation steps — reverse lookup */}
            {(() => {
              const touchingSteps = steps.filter((s) => s.architecture.includes(selectedObject.slug));
              return touchingSteps.length > 0 ? (
                <div>
                  <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Implementation steps
                  </div>
                  <div className="space-y-1">
                    {touchingSteps.map((s) => {
                      const ss = STEP_STATUS_STYLES[s.status];
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStep(selectedStep?.id === s.id ? null : s)}
                          className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${ss.dot}`} />
                          <span className="text-gray-700 font-medium leading-tight">
                            {formatStepName(s.id)}
                          </span>
                          <span className={`ml-auto text-xs px-1 py-0.5 rounded font-medium ${ss.badge}`}>
                            {s.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Capabilities */}
            {selectedObject.capabilities.length > 0 && (
              <div>
                <div className="font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Capabilities
                </div>
                <div className="text-gray-600">{selectedObject.capabilities.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
