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

// ─── Main component (placeholder — layout in Task 6) ─────────────────────────

interface Props {
  archObjects: ArchitectureObject[];
  steps: ImplementationStep[];
}

export default function ArchitectureGraph({ archObjects, steps }: Props) {
  return (
    <div className="flex h-full items-center justify-center text-gray-400 text-sm">
      ArchNode and helpers loaded ({archObjects.length} objects)
    </div>
  );
}
