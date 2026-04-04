'use client';

import React, { useState, useMemo } from 'react';
import type { GoalNode, CapabilityNode } from '@/lib/types';
import CausalTree from './CausalTree';
import CapabilityDAG from './CapabilityDAG';

type Tab = 'goals' | 'capabilities';

interface Props {
  goals: GoalNode[];
  capabilities: CapabilityNode[];
}

export default function Dashboard({ goals, capabilities }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('goals');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [showUnblockedOnly, setShowUnblockedOnly] = useState(false);

  // When a goal is selected, highlight the capabilities it requires
  const highlightedCapabilities = useMemo<Set<string>>(() => {
    if (!selectedGoal) return new Set();
    const goal = goals.find((g) => g.node === selectedGoal);
    return new Set(goal?.requires_capabilities ?? []);
  }, [selectedGoal, goals]);

  // When a capability is selected, highlight the goals it unlocks
  const highlightedGoals = useMemo<Set<string>>(() => {
    if (!selectedCapability) return new Set();
    const cap = capabilities.find((c) => c.slug === selectedCapability);
    return new Set(cap?.unlocks ?? []);
  }, [selectedCapability, capabilities]);

  function handleCapabilityClick(slug: string) {
    setSelectedCapability(slug);
    setSelectedGoal(null);
    setActiveTab('capabilities');
  }

  function handleGoalClick(node: string) {
    setSelectedGoal(node);
    setSelectedCapability(null);
    setActiveTab('goals');
  }

  // Stats for the header bar
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
          </div>
        </div>
        <div className="text-xs text-gray-400">reads live from wiki/business/</div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-0 shrink-0">
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'goals'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Tab 1 — Causal Goals
          {selectedGoal && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {selectedGoal}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('capabilities')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'capabilities'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Tab 2 — Capability DAG
          {selectedCapability && (
            <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
              {selectedCapability}
            </span>
          )}
        </button>

        {activeTab === 'capabilities' && (
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showUnblockedOnly}
                onChange={(e) => setShowUnblockedOnly(e.target.checked)}
                className="rounded"
              />
              Unblocked only ({unblockedCaps})
            </label>
          </div>
        )}

        {activeTab === 'goals' && highlightedCapabilities.size > 0 && (
          <div className="ml-auto text-xs text-violet-600 bg-violet-50 px-3 py-1 rounded">
            {highlightedCapabilities.size} capabilities highlighted in Tab 2
          </div>
        )}

        {activeTab === 'capabilities' && highlightedGoals.size > 0 && (
          <div className="ml-auto text-xs text-green-600 bg-green-50 px-3 py-1 rounded">
            {highlightedGoals.size} goals highlighted in Tab 1
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'goals' && (
          <CausalTree
            goals={goals}
            selectedGoal={selectedGoal}
            onSelectGoal={setSelectedGoal}
            highlightedGoals={highlightedGoals}
            onCapabilityClick={handleCapabilityClick}
          />
        )}
        {activeTab === 'capabilities' && (
          <CapabilityDAG
            capabilities={capabilities}
            selectedCapability={selectedCapability}
            onSelectCapability={setSelectedCapability}
            highlightedCapabilities={highlightedCapabilities}
            onGoalClick={handleGoalClick}
            showUnblockedOnly={showUnblockedOnly}
          />
        )}
      </div>
    </div>
  );
}
