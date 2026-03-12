import fs from 'fs';
import yaml from 'js-yaml';
import type { PipelineConfig, Field, Stage, Calculation, Report } from './types.js';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function interpolateEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? `\${${key}}`);
  }
  if (Array.isArray(obj)) return obj.map(interpolateEnvVars);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, interpolateEnvVars(v)])
    );
  }
  return obj;
}

function validateField(f: unknown, idx: number): Field {
  const field = f as Record<string, unknown>;
  if (!field.name || typeof field.name !== 'string') throw new ConfigValidationError(`fields[${idx}].name is required`);
  if (!['string', 'number', 'date', 'enum'].includes(field.type as string)) {
    throw new ConfigValidationError(`fields[${idx}].type must be string|number|date|enum, got "${field.type}"`);
  }
  if (field.type === 'enum' && (!Array.isArray(field.options) || (field.options as unknown[]).length === 0)) {
    throw new ConfigValidationError(`fields[${idx}] (${field.name}) is type enum but has no options`);
  }
  return field as unknown as Field;
}

function validateStage(s: unknown, idx: number): Stage {
  const stage = s as Record<string, unknown>;
  if (!stage.name || typeof stage.name !== 'string') throw new ConfigValidationError(`stages[${idx}].name is required`);
  if (!stage.label || typeof stage.label !== 'string') throw new ConfigValidationError(`stages[${idx}].label is required`);
  return stage as unknown as Stage;
}

function validateCalculation(c: unknown, idx: number): Calculation {
  const calc = c as Record<string, unknown>;
  if (!calc.name) throw new ConfigValidationError(`calculations[${idx}].name is required`);
  if (!calc.formula) throw new ConfigValidationError(`calculations[${idx}].formula is required`);
  if (!['sum', 'average', 'count', 'percent'].includes(calc.aggregate as string)) {
    throw new ConfigValidationError(`calculations[${idx}].aggregate must be sum|average|count|percent`);
  }
  return calc as unknown as Calculation;
}

function validateReport(r: unknown, idx: number): Report {
  const report = r as Record<string, unknown>;
  if (!report.name) throw new ConfigValidationError(`reports[${idx}].name is required`);
  if (!Array.isArray(report.calculations)) throw new ConfigValidationError(`reports[${idx}].calculations must be an array`);
  return report as unknown as Report;
}

export function loadConfig(filePath: string): PipelineConfig {
  if (!fs.existsSync(filePath)) throw new ConfigValidationError(`Config file not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = interpolateEnvVars(yaml.load(raw)) as Record<string, unknown>;

  if (!parsed.name || typeof parsed.name !== 'string') throw new ConfigValidationError('config.name is required');
  if (!parsed.github || typeof parsed.github !== 'object') throw new ConfigValidationError('config.github is required');

  const github = parsed.github as Record<string, unknown>;
  if (!github.owner) throw new ConfigValidationError('config.github.owner is required');
  if (!github.repo) throw new ConfigValidationError('config.github.repo is required');

  const fields = (Array.isArray(parsed.fields) ? parsed.fields : []).map(validateField);
  const stages = (Array.isArray(parsed.stages) ? parsed.stages : []).map(validateStage);
  const calculations = (Array.isArray(parsed.calculations) ? parsed.calculations : []).map(validateCalculation);
  const reports = (Array.isArray(parsed.reports) ? parsed.reports : []).map(validateReport);

  return {
    name: parsed.name,
    github: { owner: github.owner as string, repo: github.repo as string },
    fields,
    stages,
    owners: Array.isArray(parsed.owners) ? (parsed.owners as string[]) : undefined,
    calculations,
    reports,
    staleness: parsed.staleness as PipelineConfig['staleness'],
  };
}
