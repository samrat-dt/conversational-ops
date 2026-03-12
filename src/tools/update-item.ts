import type { PipelineConfig } from '../config/types.js';
import { getIssue, updateIssue } from '../github/issues.js';
import { ensureLabel, applyLabel, removeLabel } from '../github/labels.js';
import type { ToolDefinition } from '../llm/types.js';

export const updateItemDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_item',
    description: 'Update stage, fields, or owner on an existing pipeline item by issue number',
    parameters: {
      type: 'object',
      properties: {
        issue_number: { type: 'number', description: 'GitHub issue number to update' },
        stage: { type: 'string', description: 'New stage name (optional)' },
        fields: {
          type: 'object',
          description: 'Field key-value pairs to update in the issue body (optional)',
          additionalProperties: true,
        },
        owner: { type: 'string', description: 'New GitHub username to assign (optional)' },
        close: { type: 'boolean', description: 'Set to true to close the issue' },
      },
      required: ['issue_number'],
    },
  },
};

export async function updateItem(
  config: PipelineConfig,
  args: { issue_number: number; stage?: string; fields?: Record<string, unknown>; owner?: string; close?: boolean }
): Promise<string> {
  const { owner: ghOwner, repo } = config.github;
  const issue = await getIssue(ghOwner, repo, args.issue_number);

  const updates: { body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[] } = {};

  // Stage change: swap stage labels
  let currentLabels = [...issue.labels];
  if (args.stage) {
    const newStage = config.stages.find(s => s.name.toLowerCase() === args.stage!.toLowerCase());
    if (!newStage) {
      return `Error: stage "${args.stage}" not found. Available: ${config.stages.map(s => s.name).join(', ')}`;
    }
    // Remove old stage labels
    const stageLabels = config.stages.map(s => s.label);
    currentLabels = currentLabels.filter(l => !stageLabels.includes(l));
    currentLabels.push(newStage.label);
    await ensureLabel(ghOwner, repo, newStage.label);
    updates.labels = currentLabels;
  }

  // Update fields in body
  if (args.fields && Object.keys(args.fields).length > 0) {
    let body = issue.body ?? '';
    for (const [key, value] of Object.entries(args.fields)) {
      const fieldRegex = new RegExp(`(- \\*\\*${key}:\\*\\* )(.*)`, 'i');
      if (fieldRegex.test(body)) {
        body = body.replace(fieldRegex, `$1${value}`);
      } else {
        body += `\n- **${key}:** ${value}`;
      }
    }
    updates.body = body;
  }

  if (args.owner) {
    updates.assignees = [args.owner];
  }

  if (args.close) {
    updates.state = 'closed';
  }

  await updateIssue(ghOwner, repo, args.issue_number, updates);
  return `Updated item #${args.issue_number}: "${issue.title}"${args.stage ? ` → stage "${args.stage}"` : ''}`;
}
