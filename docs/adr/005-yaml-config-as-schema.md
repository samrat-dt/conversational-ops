# ADR 005 — YAML config files as the pipeline schema layer

**Date:** 2026-03-13
**Status:** Accepted
**Deciders:** @samrat-dt

---

## Context

We need a way to define pipeline structure: what fields exist, what stages exist, how calculations work, what reports look like. This schema must be editable by non-engineers (ops managers, sales ops, etc.).

## Decision

YAML config files in `templates/` define the full pipeline schema. Environment variables (`${VAR}`) in YAML are interpolated at load time. The `loadConfig()` function validates the YAML and returns a typed `PipelineConfig` object.

```yaml
name: Sales Pipeline
github:
  owner: ${GITHUB_OWNER}
  repo: ${GITHUB_REPO}
fields:
  - name: value
    type: number
    required: true
stages:
  - name: Qualified
    label: stage:qualified
    probability: 0.3
calculations:
  - name: weighted_pipeline
    formula: value * probability
    aggregate: sum
```

## Consequences

**Positive:**
- Non-engineers can read and edit YAML without writing code
- Version-controlled with the codebase (change history in git)
- New use-case in 5 minutes: copy a template, edit field names and stages
- Environment variable interpolation allows the same template to work across repos
- Typed `PipelineConfig` interface gives compile-time safety after parsing

**Negative:**
- No runtime schema migration — changing a field name doesn't update existing issues
- Limited expressiveness — complex conditional logic or multi-step formulas aren't supported
- Formula evaluation uses `Function()` with a limited safe expression check — not suitable for untrusted user input

## Formula Evaluation

Formulas like `value * probability` are evaluated per-issue by:
1. Building a context object from field values parsed from the issue body
2. Substituting field names with their values in the formula string
3. Checking the result is a safe numeric expression (regex: `/^[\d\s+\-*/().]+$/`)
4. Evaluating with `Function("return (" + expr + ")")`

This is safe because formulas are operator-controlled (in version-controlled YAML), not user-submitted.

## Alternatives Considered

- **TypeScript config objects**: Type-safe but requires code change + redeploy to change schema. Non-engineers can't edit.
- **Database-stored config**: Dynamic but requires UI to edit, adds a DB dependency.
- **JSON Schema**: More verbose than YAML, harder to read for non-engineers.
- **DSL (custom language)**: Too much engineering overhead for the gain.
