'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchConfigs, fetchItems } from '@/lib/api';
import type { PipelineConfigMeta, PipelineItem, Stage } from '@/lib/api';

interface StageStat {
  stage: Stage;
  count: number;
}

interface SidebarProps {
  activeConfig: string;
}

export function Sidebar({ activeConfig }: SidebarProps) {
  const [configs, setConfigs] = useState<PipelineConfigMeta[]>([]);
  const [stageStats, setStageStats] = useState<StageStat[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    fetchConfigs().then(setConfigs).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeConfig) return;
    fetchItems(activeConfig)
      .then(({ items, stages }) => {
        const counts: Record<string, number> = {};
        for (const stage of stages) counts[stage.label] = 0;
        for (const item of items) {
          const label = item.labels.find(l => l.startsWith('stage:'));
          if (label && label in counts) counts[label]++;
        }
        setStageStats(stages.map(stage => ({ stage, count: counts[stage.label] ?? 0 })));
        setTotalItems(items.length);
      })
      .catch(console.error);
  }, [activeConfig]);

  const maxCount = Math.max(...stageStats.map(s => s.count), 1);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="text-xs font-bold text-emerald-400 tracking-widest uppercase">conv-ops</div>
        <div className="text-zinc-500 text-xs mt-0.5">GitHub Issues as DB</div>
      </div>

      {/* Pipeline nav */}
      <nav className="px-2 py-3 border-b border-zinc-800">
        <div className="text-zinc-500 text-xs px-2 mb-2 uppercase tracking-wider">Pipelines</div>
        {configs.map(cfg => (
          <Link
            key={cfg.id}
            href={`/${cfg.id}`}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              cfg.id === activeConfig
                ? 'bg-emerald-900/40 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.id === activeConfig ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            {cfg.name}
          </Link>
        ))}
      </nav>

      {/* Stage breakdown */}
      {stageStats.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="text-zinc-500 text-xs mb-3 uppercase tracking-wider">Pipeline</div>
          <div className="space-y-2">
            {stageStats.map(({ stage, count }) => (
              <div key={stage.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-zinc-400 truncate pr-2">{stage.name}</span>
                  <span className="text-zinc-300 font-mono">{count}</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      {totalItems > 0 && (
        <div className="px-4 py-3">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Total open</span>
            <span className="text-zinc-300 font-mono font-bold">{totalItems}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-4 py-3 border-t border-zinc-800">
        <a
          href="https://github.com/samrat-dt/conversational-ops"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          github ↗
        </a>
      </div>
    </aside>
  );
}
