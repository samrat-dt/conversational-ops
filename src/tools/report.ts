import type { PipelineConfig } from '../config/types.js';
import { listIssues } from '../github/issues.js';
import { calculate } from './calculate.js';
import type { ToolDefinition } from '../llm/types.js';

export const reportDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'report',
    description: 'Generate a full dashboard summary with counts by stage and configured calculations',
    parameters: {
      type: 'object',
      properties: {
        report_name: { type: 'string', description: 'Name of the report from config (optional, defaults to first report)' },
      },
      required: [],
    },
  },
};

export async function report(
  config: PipelineConfig,
  args: { report_name?: string }
): Promise<string> {
  const rpt = args.report_name
    ? config.reports.find(r => r.name.toLowerCase() === args.report_name!.toLowerCase())
    : config.reports[0];

  if (!rpt && config.reports.length > 0) {
    return `Error: report "${args.report_name}" not found. Available: ${config.reports.map(r => r.name).join(', ')}`;
  }

  const { owner, repo } = config.github;
  const allIssues = await listIssues(owner, repo, { state: 'open' });

  // Count by stage
  const stageCounts: Record<string, number> = {};
  for (const stage of config.stages) {
    stageCounts[stage.name] = 0;
  }
  for (const issue of allIssues) {
    const stageLabel = issue.labels.find(l => l.startsWith('stage:'));
    const stage = config.stages.find(s => s.label === stageLabel);
    if (stage) stageCounts[stage.name] = (stageCounts[stage.name] ?? 0) + 1;
  }

  const lines: string[] = [
    `╔${'═'.repeat(58)}╗`,
    `║  ${config.name.padEnd(56)}║`,
    `╠${'═'.repeat(58)}╣`,
    `║  PIPELINE OVERVIEW${' '.repeat(39)}║`,
    `╠${'═'.repeat(58)}╣`,
  ];

  for (const stage of config.stages) {
    const count = stageCounts[stage.name] ?? 0;
    const bar = '█'.repeat(Math.min(count, 20));
    const label = `  ${stage.name.padEnd(20)} ${String(count).padStart(3)}  ${bar}`;
    lines.push(`║${label.padEnd(58)}║`);
  }

  lines.push(`╠${'═'.repeat(58)}╣`);
  lines.push(`║  CALCULATIONS${' '.repeat(44)}║`);
  lines.push(`╠${'═'.repeat(58)}╣`);

  const calcNames = rpt?.calculations ?? config.calculations.map(c => c.name);
  for (const calcName of calcNames) {
    const result = await calculate(config, { calculation_name: calcName });
    lines.push(`║  ${result.substring(0, 56).padEnd(56)}║`);
  }

  lines.push(`╠${'═'.repeat(58)}╣`);
  lines.push(`║  Total open items: ${String(allIssues.length).padEnd(38)}║`);
  lines.push(`╚${'═'.repeat(58)}╝`);

  return lines.join('\n');
}
