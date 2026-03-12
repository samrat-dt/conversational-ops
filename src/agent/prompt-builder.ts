import type { PipelineConfig } from '../config/types.js';

export function buildSystemPrompt(config: PipelineConfig): string {
  const stageList = config.stages.map(s => `- ${s.name} (label: ${s.label}${s.probability !== undefined ? `, p=${s.probability}` : ''})`).join('\n');
  const fieldList = config.fields.map(f => {
    const opts = f.options ? ` | options: [${f.options.join(', ')}]` : '';
    return `- ${f.name}: ${f.type}${f.required ? ' (required)' : ''}${opts}`;
  }).join('\n');
  const calcList = config.calculations.map(c => `- ${c.name}: ${c.description} [formula: ${c.formula}, aggregate: ${c.aggregate}]`).join('\n');
  const reportList = config.reports.map(r => `- ${r.name}`).join('\n');

  return `You are an intelligent operations assistant managing the "${config.name}" pipeline.

## Pipeline: ${config.name}
GitHub repo: ${config.github.owner}/${config.github.repo}

## Stages
${stageList}

## Fields
${fieldList}

## Calculations
${calcList}

## Reports
${reportList || '(none configured)'}
${config.staleness ? `\n## Staleness Policy\nFlag items with no activity after ${config.staleness.days} days via ${config.staleness.action}: "${config.staleness.message}"` : ''}

## Your Role
You help users manage this pipeline through natural language. You can:
- Create, update, and list items
- Log activities (calls, meetings, emails, notes)
- Run calculations and generate reports
- Flag stale items

## Guidelines
- Always use the available tools to take actions — do not just describe what you would do
- Be concise and action-oriented
- When a user mentions creating an item, extract the title, stage, and fields and call create_item
- When listing items, use list_items with appropriate filters
- When uncertain about a stage or field name, use the closest match and confirm with the user
- Format numbers readably (e.g. $50,000 not 50000)
- Today's date: ${new Date().toISOString().split('T')[0]}
`;
}
