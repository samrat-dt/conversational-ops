import type { PipelineConfig } from '../config/types.js';
import { createIssue } from '../github/issues.js';
import { ensureLabel, applyLabel } from '../github/labels.js';
import type { ToolDefinition } from '../llm/types.js';

export const createItemDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_item',
    description: 'Create a new pipeline item (GitHub issue) with initial stage and field values',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title / name of the item (deal name, candidate name, etc.)' },
        stage: { type: 'string', description: 'Initial stage name (must match a configured stage)' },
        fields: {
          type: 'object',
          description: 'Key-value pairs of field names to values (e.g. { "value": 50000, "probability": 0.6 })',
          additionalProperties: true,
        },
        owner: { type: 'string', description: 'GitHub username to assign this item to (optional)' },
      },
      required: ['title', 'stage'],
    },
  },
};

export async function createItem(
  config: PipelineConfig,
  args: { title: string; stage: string; fields?: Record<string, unknown>; owner?: string }
): Promise<string> {
  const { owner: ghOwner, repo } = config.github;

  const stage = config.stages.find(s => s.name.toLowerCase() === args.stage.toLowerCase());
  if (!stage) {
    return `Error: stage "${args.stage}" not found. Available: ${config.stages.map(s => s.name).join(', ')}`;
  }

  // Build issue body from fields
  const fieldLines = Object.entries(args.fields ?? {}).map(([k, v]) => `- **${k}:** ${v}`);
  const body = [
    `## ${config.name} Item`,
    '',
    `**Stage:** ${stage.name}`,
    ...(args.owner ? [`**Owner:** @${args.owner}`] : []),
    '',
    '### Fields',
    ...fieldLines,
  ].join('\n');

  const labels = [stage.label];

  // Ensure the stage label exists on the repo
  await ensureLabel(ghOwner, repo, stage.label);

  const issue = await createIssue({
    owner: ghOwner,
    repo,
    title: args.title,
    body,
    labels,
    assignees: args.owner ? [args.owner] : [],
  });

  return `Created item #${issue.number}: "${issue.title}" in stage "${stage.name}"\n${issue.html_url}`;
}
