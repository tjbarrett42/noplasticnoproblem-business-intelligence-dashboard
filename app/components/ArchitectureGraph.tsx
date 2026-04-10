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
  EdgeTypes,
  Handle,
  Position,
  BaseEdge,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
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

// Containment layout constants (for part_of nesting)
const CONTAINER_PAD_X = 10;       // horizontal inset for child node within parent
const CONTAINER_PAD_TOP = 10;     // gap between parent header area and first child
const CONTAINER_PAD_BOTTOM = 10;  // gap below last child
const CONTAINER_CHILD_GAP = 8;    // gap between sibling children

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

// ─── Floating edge helpers ────────────────────────────────────────────────────

/**
 * Returns the point on the border of a rectangle (defined by x, y, width, height)
 * that lies on the line from the rectangle's center toward `toward`.
 */
function getNodeBorderPoint(
  node: { x: number; y: number; width: number; height: number },
  toward: { x: number; y: number },
): { x: number; y: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  // Scale factor to reach the nearest border in each axis
  const tx = dx !== 0 ? (node.width / 2) / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? (node.height / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Custom edge that connects from the nearest border point of the source node
 * to the nearest border point of the target node, ignoring fixed handle positions.
 * Works correctly for any layout direction and for child nodes nested inside containers.
 */
function FloatingEdge({ id, source, target, markerEnd, style, label, labelStyle }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode?.internals.positionAbsolute || !targetNode?.internals.positionAbsolute) {
    return null;
  }

  const sw = sourceNode.measured?.width ?? ARCH_NODE_W;
  const sh = sourceNode.measured?.height ?? ARCH_NODE_H;
  const tw = targetNode.measured?.width ?? ARCH_NODE_W;
  const th = targetNode.measured?.height ?? ARCH_NODE_H;

  const sourceBounds = { x: sourceNode.internals.positionAbsolute.x, y: sourceNode.internals.positionAbsolute.y, width: sw, height: sh };
  const targetBounds = { x: targetNode.internals.positionAbsolute.x, y: targetNode.internals.positionAbsolute.y, width: tw, height: th };

  const sourceCenter = { x: sourceBounds.x + sw / 2, y: sourceBounds.y + sh / 2 };
  const targetCenter = { x: targetBounds.x + tw / 2, y: targetBounds.y + th / 2 };

  const sourcePoint = getNodeBorderPoint(sourceBounds, targetCenter);
  const targetPoint = getNodeBorderPoint(targetBounds, sourceCenter);

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
    />
  );
}

const archEdgeTypes: EdgeTypes = { floating: FloatingEdge };

// ─── ArchNode custom ReactFlow node ──────────────────────────────────────────

type ArchNodeData = {
  object: ArchitectureObject;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  containerHeight?: number;
  containerWidth?: number;
};

function ArchNode({ data }: { data: ArchNodeData }) {
  const { object, isSelected, isHighlighted, onClick, containerHeight, containerWidth } = data;
  const styles = STATUS_STYLES[object.status];
  const Icon = TYPE_ICONS[object.type];
  const hasBlockers = object.blockers.length > 0;
  const isContainer = containerHeight !== undefined;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        onClick={onClick}
        className="cursor-pointer rounded-lg border-2 transition-all relative"
        style={{
          width: containerWidth ?? ARCH_NODE_W,
          // Container nodes: fixed height so the child area is always visible.
          // Regular nodes: minHeight only, grows with content.
          ...(isContainer ? { height: containerHeight } : { minHeight: ARCH_NODE_H, overflow: 'hidden' }),
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
        {/* Dashed separator between parent header and child area */}
        {isContainer && (
          <div
            className="absolute left-3 right-3 border-t border-dashed border-gray-300"
            style={{ top: ARCH_NODE_H - 4 }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  );
}

const archNodeTypes: NodeTypes = { arch: ArchNode };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStepName(id: string): string {
  return id.replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, '').replace(/-/g, ' ');
}

// ─── buildArchLayout ──────────────────────────────────────────────────────────

// Returns expanded width/height for a parent container node given its child count.
function containerDims(childCount: number): { w: number; h: number } {
  return {
    w: ARCH_NODE_W + 2 * CONTAINER_PAD_X,
    h:
      ARCH_NODE_H +
      CONTAINER_PAD_TOP +
      childCount * ARCH_NODE_H +
      Math.max(0, childCount - 1) * CONTAINER_CHILD_GAP +
      CONTAINER_PAD_BOTTOM,
  };
}

function buildArchLayout(
  objects: ArchitectureObject[],
  selectedSlug: string | null,
  highlightedSlugs: Set<string>,
  showRequires: boolean,
  showDataFlow: boolean,
  onSelectNode: (slug: string | null) => void,
): { nodes: Node[]; edges: Edge[] } {
  const slugSet = new Set(objects.map((o) => o.slug));

  // ── Build containment maps from part_of ──────────────────────────────────
  // childrenOf: parentSlug → ordered list of child slugs
  // parentOf:   childSlug → parentSlug  (only when parent exists in this dataset)
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  objects.forEach((o) => {
    o.part_of.forEach((parentSlug) => {
      if (!slugSet.has(parentSlug)) return;
      if (!childrenOf.has(parentSlug)) childrenOf.set(parentSlug, []);
      childrenOf.get(parentSlug)!.push(o.slug);
      parentOf.set(o.slug, parentSlug);
    });
  });

  // Pairs where an edge between them would be redundant with visual containment.
  const containmentPairs = new Set<string>();
  parentOf.forEach((parentSlug, childSlug) => {
    containmentPairs.add(`${childSlug}→${parentSlug}`);
    containmentPairs.add(`${parentSlug}→${childSlug}`);
  });

  // ── Dagre layout — top-level nodes only ──────────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 70 });

  objects.forEach((o) => {
    if (parentOf.has(o.slug)) return; // children are positioned relative to parent, not dagre
    const children = childrenOf.get(o.slug);
    if (children) {
      const { w, h } = containerDims(children.length);
      g.setNode(o.slug, { width: w, height: h });
    } else {
      g.setNode(o.slug, { width: ARCH_NODE_W, height: ARCH_NODE_H });
    }
  });

  // Add requires edges to dagre for rank ordering.
  // When the required object is a child, redirect to its parent for layout purposes.
  objects.forEach((o) => {
    if (parentOf.has(o.slug)) return; // skip children
    o.requires.forEach((req) => {
      const layoutReq = parentOf.has(req) ? parentOf.get(req)! : req;
      if (slugSet.has(layoutReq) && layoutReq !== o.slug) g.setEdge(layoutReq, o.slug);
    });
  });

  dagre.layout(g);

  // ── Build ReactFlow nodes ─────────────────────────────────────────────────
  const nodes: Node[] = [];

  objects.forEach((o) => {
    if (parentOf.has(o.slug)) return; // handle children separately below

    const children = childrenOf.get(o.slug);
    const isParent = !!children;
    const dims = isParent ? containerDims(children!.length) : null;
    const { x, y } = g.node(o.slug);
    const nodeW = dims ? dims.w : ARCH_NODE_W;
    const nodeH = dims ? dims.h : ARCH_NODE_H;

    nodes.push({
      id: o.slug,
      type: 'arch',
      position: { x: x - nodeW / 2, y: y - nodeH / 2 },
      ...(dims ? { style: { width: dims.w, height: dims.h } } : {}),
      data: {
        object: o,
        isSelected: selectedSlug === o.slug,
        isHighlighted: highlightedSlugs.has(o.slug),
        onClick: () => onSelectNode(selectedSlug === o.slug ? null : o.slug),
        ...(dims ? { containerHeight: dims.h, containerWidth: dims.w } : {}),
      },
    });

    // Position children relative to this parent
    if (children) {
      children.forEach((childSlug, idx) => {
        const childObj = objects.find((c) => c.slug === childSlug)!;
        nodes.push({
          id: childSlug,
          type: 'arch',
          parentId: o.slug,
          extent: 'parent',
          position: {
            x: CONTAINER_PAD_X,
            y: ARCH_NODE_H + CONTAINER_PAD_TOP + idx * (ARCH_NODE_H + CONTAINER_CHILD_GAP),
          },
          data: {
            object: childObj,
            isSelected: selectedSlug === childSlug,
            isHighlighted: highlightedSlugs.has(childSlug),
            onClick: () => onSelectNode(selectedSlug === childSlug ? null : childSlug),
          },
        });
      });
    }
  });

  // ── Build ReactFlow edges ─────────────────────────────────────────────────
  const edges: Edge[] = [];

  if (showRequires) {
    objects.forEach((o) => {
      o.requires.forEach((req) => {
        if (!slugSet.has(req)) return;
        // Suppress edges that are redundant with visual containment
        if (containmentPairs.has(`${o.slug}→${req}`)) return;
        const isActive =
          selectedSlug === o.slug ||
          selectedSlug === req ||
          highlightedSlugs.has(o.slug) ||
          highlightedSlugs.has(req);
        edges.push({
          id: `req:${req}->${o.slug}`,
          type: 'floating',
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
          if (containmentPairs.has(`${o.slug}→${target}`)) return;
          edges.push({
            id: `${field}:${o.slug}->${target}`,
            type: 'floating',
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
            edgeTypes={archEdgeTypes}
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
