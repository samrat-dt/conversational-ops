import type { PipelineConfig } from '../config/types.js';
import { listIssues, type GitHubIssue } from '../github/issues.js';
import type { ToolDefinition } from '../llm/types.js';

export const calculateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Run a named calculation from the config on the current pipeline items',
    parameters: {
      type: 'object',
      properties: {
        calculation_name: { type: 'string', description: 'Name of the calculation to run (from config)' },
        stage_filter: { type: 'string', description: 'Optionally limit to items in this stage' },
      },
      required: ['calculation_name'],
    },
  },
};

/** Parse a field value from issue body markdown */
function parseFieldFromBody(body: string | null, fieldName: string): number | null {
  if (!body) return null;
  const match = body.match(new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([\\d.]+)`, 'i'));
  return match ? parseFloat(match[1]) : null;
}

/** Safely evaluate a simple formula like "value * probability" given issue context */
function evaluateFormula(formula: string, context: Record<string, number>): number | null {
  try {
    // Replace field names with their values
    let expr = formula;
    for (const [k, v] of Object.entries(context)) {
      expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v));
    }
    // Only allow safe numeric expressions
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
    return Function(`"use strict"; return (${expr})`)() as number;
  } catch {
    return null;
  }
}

/** Evaluate a boolean stage comparison like "stage == 'closed-won'" */
function evaluateStageFormula(formula: string, stageName: string): boolean {
  const match = formula.match(/stage\s*==\s*['"]([^'"]+)['"]/i);
  if (!match) return false;
  return stageName.toLowerCase() === match[1].toLowerCase();
}

export async function calculate(
  config: PipelineConfig,
  args: { calculation_name: string; stage_filter?: string }
): Promise<string> {
  const calc = config.calculations.find(c => c.name.toLowerCase() === args.calculation_name.toLowerCase());
  if (!calc) {
    return `Error: calculation "${args.calculation_name}" not found. Available: ${config.calculations.map(c => c.name).join(', ')}`;
  }

  const { owner, repo } = config.github;
  let labelFilter: string | undefined;
  if (args.stage_filter) {
    const stage = config.stages.find(s => s.name.toLowerCase() === args.stage_filter!.toLowerCase());
    labelFilter = stage?.label;
  }

  const issues = await listIssues(owner, repo, { labels: labelFilter, state: 'open' });

  if (issues.length === 0) {
    return `No open items found${args.stage_filter ? ` in stage "${args.stage_filter}"` : ''}.`;
  }

  const isStageFormula = /stage\s*==/.test(calc.formula);

  const values: number[] = [];
  let matchCount = 0;

  for (const issue of issues) {
    if (isStageFormula) {
      const stageLabel = issue.labels.find(l => l.startsWith('stage:'));
      const stageName = stageLabel
        ? config.stages.find(s => s.label === stageLabel)?.name ?? ''
        : '';
      if (evaluateStageFormula(calc.formula, stageName)) matchCount++;
    } else {
      // Build context from field values parsed from body
      const context: Record<string, number> = {};
      for (const field of config.fields) {
        if (field.type === 'number') {
          const val = parseFieldFromBody(issue.body, field.name);
          if (val !== null) context[field.name] = val;
        }
      }
      // Also add stage probability if referenced
      const stageLabel = issue.labels.find(l => l.startsWith('stage:'));
      const stage = config.stages.find(s => s.label === stageLabel);
      if (stage?.probability !== undefined) context['probability'] = stage.probability;

      const result = evaluateFormula(calc.formula, context);
      if (result !== null) values.push(result);
    }
  }

  let result: number;
  const total = issues.length;

  if (isStageFormula) {
    if (calc.aggregate === 'percent') {
      result = total > 0 ? (matchCount / total) * 100 : 0;
      return `${calc.name}: ${result.toFixed(1)}% (${matchCount}/${total}) — ${calc.description}`;
    }
    result = matchCount;
  } else {
    if (values.length === 0) return `${calc.name}: No computable values found`;
    switch (calc.aggregate) {
      case 'sum': result = values.reduce((a, b) => a + b, 0); break;
      case 'average': result = values.reduce((a, b) => a + b, 0) / values.length; break;
      case 'count': result = values.length; break;
      default: result = values.reduce((a, b) => a + b, 0);
    }
  }

  const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(2);
  return `${calc.name}: ${formatted} — ${calc.description}`;
}
