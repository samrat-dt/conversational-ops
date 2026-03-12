import type { PipelineConfig } from '../config/types.js';
import { addComment } from '../github/comments.js';
import type { ToolDefinition } from '../llm/types.js';

export const logActivityDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'log_activity',
    description: 'Add a comment to a pipeline item (call log, meeting note, status update)',
    parameters: {
      type: 'object',
      properties: {
        issue_number: { type: 'number', description: 'GitHub issue number to comment on' },
        note: { type: 'string', description: 'The activity note, call log, or status update text' },
        activity_type: {
          type: 'string',
          enum: ['call', 'meeting', 'email', 'note', 'status_update', 'other'],
          description: 'Type of activity being logged',
        },
      },
      required: ['issue_number', 'note'],
    },
  },
};

export async function logActivity(
  config: PipelineConfig,
  args: { issue_number: number; note: string; activity_type?: string }
): Promise<string> {
  const { owner, repo } = config.github;
  const type = args.activity_type ?? 'note';
  const now = new Date().toISOString().split('T')[0];
  const body = `### ${type.toUpperCase().replace('_', ' ')} — ${now}\n\n${args.note}`;

  const comment = await addComment(owner, repo, args.issue_number, body);
  return `Logged activity on #${args.issue_number} (comment #${comment.id})`;
}
