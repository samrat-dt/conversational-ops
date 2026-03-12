import type { PipelineConfig } from '../config/types.js';
import type { ToolDefinition } from '../llm/types.js';
import { createItemDefinition, createItem } from '../tools/create-item.js';
import { updateItemDefinition, updateItem } from '../tools/update-item.js';
import { listItemsDefinition, listItems } from '../tools/list-items.js';
import { logActivityDefinition, logActivity } from '../tools/log-activity.js';
import { calculateDefinition, calculate } from '../tools/calculate.js';
import { reportDefinition, report } from '../tools/report.js';

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const helpDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'help',
    description: 'List available stages, fields, calculations, and example commands for the loaded pipeline config',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

function buildHelp(config: PipelineConfig): string {
  const stages = config.stages.map(s => `  • ${s.name} (label: ${s.label})`).join('\n');
  const fields = config.fields.map(f => {
    const opts = f.options ? ` [${f.options.join(', ')}]` : '';
    return `  • ${f.name} (${f.type}${f.required ? ', required' : ''}${opts})`;
  }).join('\n');
  const calcs = config.calculations.map(c => `  • ${c.name}: ${c.description}`).join('\n');
  const reports = config.reports.map(r => `  • ${r.name}`).join('\n');

  return [
    `=== ${config.name} Help ===`,
    '',
    `STAGES:\n${stages}`,
    '',
    `FIELDS:\n${fields}`,
    '',
    `CALCULATIONS:\n${calcs}`,
    '',
    `REPORTS:\n${reports || '  (none)'}`,
    '',
    'EXAMPLE COMMANDS:',
    `  "Add a new item called 'Acme Corp' at ${config.stages[0]?.name ?? 'stage'} stage"`,
    '  "List all open items"',
    '  "Move item #5 to the next stage"',
    `  "Run ${config.calculations[0]?.name ?? 'calculation'}"`,
    '  "Show the full dashboard report"',
  ].join('\n');
}

export function buildToolRegistry(config: PipelineConfig): Map<string, RegisteredTool> {
  const registry = new Map<string, RegisteredTool>();

  const tools: Array<{ definition: ToolDefinition; handler: ToolHandler }> = [
    {
      definition: createItemDefinition,
      handler: args => createItem(config, args as Parameters<typeof createItem>[1]),
    },
    {
      definition: updateItemDefinition,
      handler: args => updateItem(config, args as Parameters<typeof updateItem>[1]),
    },
    {
      definition: listItemsDefinition,
      handler: args => listItems(config, args as Parameters<typeof listItems>[1]),
    },
    {
      definition: logActivityDefinition,
      handler: args => logActivity(config, args as Parameters<typeof logActivity>[1]),
    },
    {
      definition: calculateDefinition,
      handler: args => calculate(config, args as Parameters<typeof calculate>[1]),
    },
    {
      definition: reportDefinition,
      handler: args => report(config, args as Parameters<typeof report>[1]),
    },
    {
      definition: helpDefinition,
      handler: async () => buildHelp(config),
    },
  ];

  for (const tool of tools) {
    registry.set(tool.definition.function.name, tool);
  }

  return registry;
}
