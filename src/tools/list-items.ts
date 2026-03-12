import type { PipelineConfig } from '../config/types.js';
import { listIssues } from '../github/issues.js';
import type { ToolDefinition } from '../llm/types.js';

export const listItemsDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_items',
    description: 'List pipeline items, optionally filtered by stage, owner, or staleness',
    parameters: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Filter by stage name (optional)' },
        owner: { type: 'string', description: 'Filter by assignee GitHub username (optional)' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state filter (default: open)' },
        stale_days: { type: 'number', description: 'Show only issues with no activity in this many days (optional)' },
      },
      required: [],
    },
  },
};

export async function listItems(
  config: PipelineConfig,
  args: { stage?: string; owner?: string; state?: 'open' | 'closed' | 'all'; stale_days?: number }
): Promise<string> {
  const { owner: ghOwner, repo } = config.github;

  let stageLabel: string | undefined;
  if (args.stage) {
    const stage = config.stages.find(s => s.name.toLowerCase() === args.stage!.toLowerCase());
    if (!stage) {
      return `Error: stage "${args.stage}" not found. Available: ${config.stages.map(s => s.name).join(', ')}`;
    }
    stageLabel = stage.label;
  }

  const issues = await listIssues(ghOwner, repo, {
    labels: stageLabel,
    state: args.state ?? 'open',
    assignee: args.owner,
  });

  let filtered = issues;
  if (args.stale_days) {
    const cutoff = Date.now() - args.stale_days * 24 * 60 * 60 * 1000;
    filtered = issues.filter(i => new Date(i.updated_at).getTime() < cutoff);
  }

  if (filtered.length === 0) {
    return 'No items found matching the criteria.';
  }

  const lines = filtered.map(issue => {
    const stageLabel = issue.labels.find(l => l.startsWith('stage:'));
    const stageName = stageLabel
      ? config.stages.find(s => s.label === stageLabel)?.name ?? stageLabel
      : 'Unknown';
    const owners = issue.assignees.length ? issue.assignees.join(', ') : 'Unassigned';
    const daysSince = Math.floor((Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    return `#${issue.number} | ${issue.title} | ${stageName} | ${owners} | ${daysSince}d ago`;
  });

  return [
    `Found ${filtered.length} item(s):`,
    `${'#'.padEnd(6)} | ${'Title'.padEnd(40)} | ${'Stage'.padEnd(15)} | ${'Owner'.padEnd(15)} | Last updated`,
    '-'.repeat(90),
    ...lines,
  ].join('\n');
}
