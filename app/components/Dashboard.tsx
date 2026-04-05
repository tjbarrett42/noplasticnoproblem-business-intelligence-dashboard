'use client';

import React, { useState, useMemo } from 'react';
import type { GoalNode, CapabilityNode, OperationNode } from '@/lib/types';
import CausalTree from './CausalTree';
import CapabilityDAG from './CapabilityDAG';
import OperationsDAG from './OperationsDAG';

type PermanentTabId = 'goals' | 'capabilities' | 'operations';

interface DynamicTab {
  id: string;
  rootSlug: string;
  label: string;
}

type TabId = PermanentTabId | string;

interface Props {
  goals: GoalNode[];
  capabilities: CapabilityNode[];
  operations: OperationNode[];
}

/** Returns the capability rooted at rootSlug and all descendants via parent chain. */
function getSubtree(rootSlug: string, all: CapabilityNode[]): CapabilityNode[] {
  const reachable = new Set<string>([rootSlug]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cap of all) {
      if (!reachable.has(cap.slug) && cap.parent && cap.parent !== 'unplaced' && reachable.has(cap.parent)) {
        reachable.add(cap.slug);
        changed = true;
      }
    }
  }
  return all.filter((c) => reachable.has(c.slug));
}

export default function Dashboard({ goals, capabilities, operations }: Props) {
  const [activeTabId, setActiveTabId] = useState<TabId>('goals');
  const [dynamicTabs, setDynamicTabs] = useState<DynamicTab[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [showUnblockedOnly, setShowUnblockedOnly] = useState(false);

  const highlightedCapabilities = useMemo<Set<string>>(() => {
    if (!selectedGoal) return new Set();
    const goal = goals.find((g) => g.node === selectedGoal);
    return new Set(goal?.requires_capabilities ?? []);
  }, [selectedGoal, goals]);

  const highlightedGoals = useMemo<Set<string>>(() => {
    if (!selectedCapability) return new Set();
    const cap = capabilities.find((c) => c.slug === selectedCapability);
    return new Set(cap?.unlocks ?? []);
  }, [selectedCapability, capabilities]);

  function handleCapabilityClick(slug: string) {
    setSelectedCapability(slug);
    setSelectedGoal(null);
    setSelectedOperation(null);
    setActiveTabId('capabilities');
  }

  function handleGoalClick(node: string) {
    setSelectedGoal(node);
    setSelectedCapability(null);
    setActiveTabId('goals');
  }

  function openInTab(slug: string, label: string) {
    const existing = dynamicTabs.find((t) => t.rootSlug === slug);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const id = `cap-${slug}`;
    setDynamicTabs((prev) => [...prev, { id, rootSlug: slug, label }]);
    setActiveTabId(id);
  }

  function closeTab(id: string) {
    setDynamicTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) setActiveTabId('capabilities');
  }

  // Stats
  const underperformingGoals = goals.filter((g) => g.status === 'underperforming').length;
  const healthyGoals = goals.filter((g) => g.status === 'healthy').length;
  const partialCaps = capabilities.filter((c) => c.status === 'partial').length;
  const unblockedCaps = capabilities.filter((c) => {
    if (c.depends_on.length === 0) return true;
    const statusMap = new Map(capabilities.map((x) => [x.slug, x.status]));
    return c.depends_on.every((d) => {
      const s = statusMap.get(d);
      return s === 'built' || s === 'operational';
    });
  }).length;

  const globalBlockers = capabilities.filter((c) => c.global_blocker && c.status !== 'operational');
  const activeTab = dynamicTabs.find((t) => t.id === activeTabId);
  const isCapStyle = activeTabId === 'capabilities' || !!activeTab;
  const definedOps = operations.filter((o) => o.status !== 'not-started').length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Global blocker banner */}
      {globalBlockers.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-300 px-6 py-2 flex items-center gap-2 text-xs text-amber-800 shrink-0">
          <span className="font-semibold">⚠ Global blocker:</span>
          {globalBlockers.map((b) => (
            <button
              key={b.slug}
              onClick={() => {
                setSelectedCapability(b.slug);
                setActiveTabId('capabilities');
              }}
              className="underline font-medium hover:text-amber-900"
            >
              {b.node} ({b.status})
            </button>
          ))}
          <span className="text-amber-700">— blocks all development work until operational</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-900 text-base">NPNP Business Intelligence</h1>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-orange-600">{underperformingGoals}</span> underperforming
            </span>
            <span>
              <span className="font-semibold text-green-600">{healthyGoals}</span> healthy
            </span>
            <span>
              <span className="font-semibold text-yellow-600">{partialCaps}</span> caps in progress
            </span>
            <span>
              <span className="font-semibold text-emerald-600">{unblockedCaps}</span> caps unblocked
            </span>
            <span>
              <span className="font-semibold text-teal-600">{definedOps}</span> ops defined
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-400">reads live from wiki/business/</div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-0 shrink-0 overflow-x-auto">
        {/* Permanent: Goals */}
        <button
          onClick={() => setActiveTabId('goals')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTabId === 'goals'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Goals
          {selectedGoal && activeTabId === 'goals' && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {selectedGoal}
            </span>
          )}
        </button>

        {/* Permanent: Capabilities */}
        <button
          onClick={() => setActiveTabId('capabilities')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTabId === 'capabilities'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Capabilities
          {selectedCapability && activeTabId === 'capabilities' && (
            <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
              {selectedCapability}
            </span>
          )}
        </button>

        {/* Permanent: Operations */}
        <button
          onClick={() => setActiveTabId('operations')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTabId === 'operations'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Operations
          {selectedOperation && activeTabId === 'operations' && (
            <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
              {selectedOperation}
            </span>
          )}
        </button>

        {/* Dynamic tabs */}
        {dynamicTabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTabId === tab.id
                ? 'border-violet-400 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <button onClick={() => setActiveTabId(tab.id)} className="mr-1.5">
              {tab.label}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="text-gray-400 hover:text-gray-600 text-base leading-none ml-1"
              title="Close tab"
            >
              ×
            </button>
          </div>
        ))}

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-3 pl-4 shrink-0">
          {isCapStyle && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showUnblockedOnly}
                onChange={(e) => setShowUnblockedOnly(e.target.checked)}
                className="rounded"
              />
              Unblocked only ({unblockedCaps})
            </label>
          )}
          {activeTabId === 'goals' && highlightedCapabilities.size > 0 && (
            <div className="text-xs text-violet-600 bg-violet-50 px-3 py-1 rounded">
              {highlightedCapabilities.size} capabilities highlighted
            </div>
          )}
          {activeTabId === 'capabilities' && highlightedGoals.size > 0 && (
            <div className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded">
              {highlightedGoals.size} goals highlighted
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTabId === 'goals' && (
          <CausalTree
            goals={goals}
            selectedGoal={selectedGoal}
            onSelectGoal={setSelectedGoal}
            highlightedGoals={highlightedGoals}
            onCapabilityClick={handleCapabilityClick}
            onOpenInTab={openInTab}
          />
        )}
        {activeTabId === 'capabilities' && (
          <CapabilityDAG
            capabilities={capabilities}
            selectedCapability={selectedCapability}
            onSelectCapability={setSelectedCapability}
            highlightedCapabilities={highlightedCapabilities}
            onGoalClick={handleGoalClick}
            showUnblockedOnly={showUnblockedOnly}
            onOpenInTab={openInTab}
          />
        )}
        {activeTab && (
          <CapabilityDAG
            capabilities={getSubtree(activeTab.rootSlug, capabilities)}
            selectedCapability={selectedCapability}
            onSelectCapability={setSelectedCapability}
            highlightedCapabilities={highlightedCapabilities}
            onGoalClick={handleGoalClick}
            showUnblockedOnly={showUnblockedOnly}
            onOpenInTab={openInTab}
          />
        )}
        {activeTabId === 'operations' && (
          <OperationsDAG
            operations={operations}
            selectedOperation={selectedOperation}
            onSelectOperation={setSelectedOperation}
            onCapabilityClick={handleCapabilityClick}
          />
        )}
      </div>
    </div>
  );
}
