'use client';

import React, { useCallback, useMemo } from 'react';
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
  useInternalNode,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { Process, ProcessStep } from '@/lib/types';

interface Props {
  processes: Process[];
  processSteps: ProcessStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
}

const NODE_W = 220;
const NODE_H = 72;

function actorColors(actor: ProcessStep['actor']) {
  switch (actor) {
    case 'system': return { stripe: '#3b82f6', label: 'system', labelColor: '#1d4ed8' };
    case 'user':   return { stripe: '#22c55e', label: 'user',   labelColor: '#15803d' };
    case 'human':  return { stripe: '#f59e0b', label: 'human',  labelColor: '#b45309' };
  }
}

function StepNode({ data }: { data: { step: ProcessStep; isSelected: boolean } }) {
  const { step, isSelected } = data;
  const colors = actorColors(step.actor);

  return (
    <div
      className={`relative bg-white rounded border ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-300'
      } overflow-hidden`}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      {/* Actor stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colors.stripe }}
      />
      <div className="pl-3 pr-2 py-2 h-full flex flex-col justify-between">
        <span className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
          {step.name}
        </span>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: colors.labelColor }}>
            {colors.label}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              step.architecture.length === 0
                ? 'bg-gray-300'
                : 'bg-amber-400'
            }`}
            title={
              step.architecture.length === 0
                ? 'No architecture links'
                : 'Architecture prerequisites not verified'
            }
          />
        </div>
      </div>
    </div>
  );
}

// FloatingEdge — routes from nearest border point (same pattern as ArchitectureGraph)
function FloatingEdge({ id, source, target, markerEnd, style }: {
  id: string;
  source: string;
  target: string;
  markerEnd?: string;
  style?: React.CSSProperties;
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sx = sourceNode.internals.positionAbsolute.x + NODE_W;
  const sy = sourceNode.internals.positionAbsolute.y + NODE_H / 2;
  const tx = targetNode.internals.positionAbsolute.x;
  const ty = targetNode.internals.positionAbsolute.y + NODE_H / 2;

  const [edgePath] = getBezierPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });
  return (
    <path id={id} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} style={style} />
  );
}

const nodeTypes: NodeTypes = { 'process-step': StepNode as NodeTypes['process-step'] };
const edgeTypes: EdgeTypes = { floating: FloatingEdge as EdgeTypes['floating'] };

function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
    }),
    edges,
  };
}

export default function ProcessGraph({ processes, processSteps, selectedStepId, onSelectStep }: Props) {
  const stepsMap = useMemo(
    () => new Map(processSteps.map((s) => [s.id, s])),
    [processSteps]
  );

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const addedSteps = new Set<string>();

    processes.forEach((process) => {
      const stepRefs = process.steps.filter((s) => s.type === 'step');
      stepRefs.forEach((ref) => {
        if (ref.type !== 'step') return;
        const step = stepsMap.get(ref.ref);
        if (!step || addedSteps.has(step.id)) return;
        addedSteps.add(step.id);
        nodes.push({
          id: step.id,
          type: 'process-step',
          position: { x: 0, y: 0 },
          data: { step, isSelected: step.id === selectedStepId },
        });
      });

      // Sequence edges between consecutive steps in this process
      for (let i = 0; i < stepRefs.length - 1; i++) {
        const a = stepRefs[i];
        const b = stepRefs[i + 1];
        if (a.type !== 'step' || b.type !== 'step') continue;
        if (!stepsMap.has(a.ref) || !stepsMap.has(b.ref)) continue;
        const edgeId = `seq-${process.id}-${a.ref}-${b.ref}`;
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: a.ref,
            target: b.ref,
            type: 'floating',
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#94a3b8' },
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          });
        }
      }
    });

    return { nodes, edges };
  }, [processes, processSteps, selectedStepId, stepsMap]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => layoutGraph(rawNodes, rawEdges),
    [rawNodes, rawEdges]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectStep(node.id === selectedStepId ? null : node.id);
    },
    [selectedStepId, onSelectStep]
  );

  const selectedStep = selectedStepId ? stepsMap.get(selectedStepId) : null;

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.3}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Step detail panel */}
      {selectedStep && (
        <div className="w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto text-sm">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{selectedStep.name}</h3>
            <button onClick={() => onSelectStep(null)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
          </div>

          <div className="mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actor</span>
            <p className="mt-1 text-gray-700 capitalize">{selectedStep.actor}</p>
          </div>

          {selectedStep.architecture.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Architecture Interactions</span>
              <ul className="mt-1 space-y-1">
                {selectedStep.architecture.map((link, i) => (
                  <li key={i} className="text-gray-700">
                    <span className="font-mono text-xs text-gray-500">{link.interaction}</span>{' '}
                    {link.object}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedStep.processes.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Used by Processes</span>
              <ul className="mt-1 space-y-1">
                {selectedStep.processes.map((p) => (
                  <li key={p} className="text-gray-700 font-mono text-xs">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedStep.body && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
              <p className="mt-1 text-gray-700 text-xs leading-relaxed">
                {selectedStep.body.split('\n')[0]}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
