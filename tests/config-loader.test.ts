import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigValidationError } from '../src/config/loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '../templates');

describe('loadConfig', () => {
  it('parses sales.yaml correctly', () => {
    const config = loadConfig(path.join(templatesDir, 'sales.yaml'));
    expect(config.name).toBe('Sales Pipeline');
    expect(config.stages.length).toBeGreaterThan(0);
    expect(config.fields.some(f => f.name === 'value')).toBe(true);
    expect(config.calculations.some(c => c.name === 'weighted_pipeline')).toBe(true);
  });

  it('parses hiring.yaml correctly', () => {
    const config = loadConfig(path.join(templatesDir, 'hiring.yaml'));
    expect(config.name).toBe('Hiring Pipeline');
    expect(config.stages.some(s => s.name === 'Applied')).toBe(true);
  });

  it('parses customer-success.yaml correctly', () => {
    const config = loadConfig(path.join(templatesDir, 'customer-success.yaml'));
    expect(config.name).toBe('Customer Success');
    expect(config.staleness?.days).toBe(14);
  });

  it('parses investor.yaml correctly', () => {
    const config = loadConfig(path.join(templatesDir, 'investor.yaml'));
    expect(config.name).toBe('Investor Tracking');
    expect(config.stages.some(s => s.label === 'stage:term-sheet')).toBe(true);
  });

  it('parses partnership.yaml correctly', () => {
    const config = loadConfig(path.join(templatesDir, 'partnership.yaml'));
    expect(config.name).toBe('Partnership Pipeline');
    expect(config.reports.length).toBeGreaterThan(0);
  });

  it('all templates have required github fields after env interpolation', () => {
    const templates = ['sales', 'hiring', 'customer-success', 'investor', 'partnership'];
    // Without env vars, the ${VAR} strings remain — that's expected for the skeleton
    for (const t of templates) {
      const config = loadConfig(path.join(templatesDir, `${t}.yaml`));
      expect(config.github).toBeDefined();
      expect(config.github.owner).toBeTruthy();
      expect(config.github.repo).toBeTruthy();
    }
  });

  it('throws ConfigValidationError for invalid stage type', async () => {
    // A YAML with bad aggregate should fail
    const { writeFileSync, unlinkSync } = await import('fs');
    const tmp = path.join(templatesDir, '_test_bad.yaml');
    writeFileSync(tmp, `
name: Bad Config
github:
  owner: test
  repo: test
fields: []
stages:
  - name: Stage1
    label: stage:s1
calculations:
  - name: test_calc
    description: test
    formula: value
    aggregate: INVALID_AGGREGATE
reports: []
`);
    try {
      expect(() => loadConfig(tmp)).toThrow(ConfigValidationError);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent/path.yaml')).toThrow(ConfigValidationError);
  });
});
