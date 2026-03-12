import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineConfig } from '../src/config/types.js';

// We test the calculate logic by mocking the GitHub listIssues dependency
vi.mock('../src/github/issues.js', () => ({
  listIssues: vi.fn(),
}));

import { calculate } from '../src/tools/calculate.js';
import { listIssues } from '../src/github/issues.js';

const mockConfig: PipelineConfig = {
  name: 'Test Pipeline',
  github: { owner: 'test-owner', repo: 'test-repo' },
  fields: [
    { name: 'value', type: 'number', required: true },
    { name: 'probability', type: 'number', required: true },
  ],
  stages: [
    { name: 'Demo', label: 'stage:demo', probability: 0.5 },
    { name: 'Closed Won', label: 'stage:closed-won', probability: 1.0 },
    { name: 'Closed Lost', label: 'stage:closed-lost', probability: 0.0 },
  ],
  calculations: [
    {
      name: 'weighted_pipeline',
      description: 'Sum of value * probability',
      formula: 'value * probability',
      aggregate: 'sum',
    },
    {
      name: 'avg_deal_size',
      description: 'Average deal value',
      formula: 'value',
      aggregate: 'average',
    },
    {
      name: 'total_count',
      description: 'Count of deals',
      formula: 'value',
      aggregate: 'count',
    },
    {
      name: 'win_rate',
      description: 'Win rate',
      formula: "stage == 'Closed Won'",
      aggregate: 'percent',
    },
  ],
  reports: [{ name: 'Dashboard', calculations: ['weighted_pipeline'] }],
};

function mockIssue(number: number, title: string, stageLabel: string, value: number, probability: number) {
  return {
    number,
    title,
    body: `## Test\n- **value:** ${value}\n- **probability:** ${probability}`,
    state: 'open',
    labels: [stageLabel],
    assignees: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: `https://github.com/test/test/issues/${number}`,
  };
}

describe('calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for unknown calculation', async () => {
    vi.mocked(listIssues).mockResolvedValue([]);
    const result = await calculate(mockConfig, { calculation_name: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('nonexistent');
  });

  it('returns message when no issues found', async () => {
    vi.mocked(listIssues).mockResolvedValue([]);
    const result = await calculate(mockConfig, { calculation_name: 'weighted_pipeline' });
    expect(result).toContain('No open items');
  });

  it('calculates weighted sum correctly', async () => {
    vi.mocked(listIssues).mockResolvedValue([
      mockIssue(1, 'Deal A', 'stage:demo', 100000, 0.5),
      mockIssue(2, 'Deal B', 'stage:demo', 50000, 0.5),
    ]);
    const result = await calculate(mockConfig, { calculation_name: 'weighted_pipeline' });
    // 100000 * 0.5 + 50000 * 0.5 = 75000
    expect(result).toContain('75000');
  });

  it('calculates average correctly', async () => {
    vi.mocked(listIssues).mockResolvedValue([
      mockIssue(1, 'Deal A', 'stage:demo', 100000, 0.5),
      mockIssue(2, 'Deal B', 'stage:demo', 50000, 0.5),
    ]);
    const result = await calculate(mockConfig, { calculation_name: 'avg_deal_size' });
    expect(result).toContain('75000');
  });

  it('calculates count correctly', async () => {
    vi.mocked(listIssues).mockResolvedValue([
      mockIssue(1, 'Deal A', 'stage:demo', 100000, 0.5),
      mockIssue(2, 'Deal B', 'stage:demo', 50000, 0.3),
      mockIssue(3, 'Deal C', 'stage:demo', 75000, 0.7),
    ]);
    const result = await calculate(mockConfig, { calculation_name: 'total_count' });
    expect(result).toContain('3');
  });

  it('calculates win rate as percent', async () => {
    vi.mocked(listIssues).mockResolvedValue([
      mockIssue(1, 'Won Deal', 'stage:closed-won', 100000, 1.0),
      mockIssue(2, 'Lost Deal', 'stage:closed-lost', 50000, 0.0),
      mockIssue(3, 'Another Won', 'stage:closed-won', 75000, 1.0),
      mockIssue(4, 'Another Lost', 'stage:closed-lost', 25000, 0.0),
    ]);
    const result = await calculate(mockConfig, { calculation_name: 'win_rate' });
    // 2 won out of 4 total = 50%
    expect(result).toContain('50.0%');
  });
});
