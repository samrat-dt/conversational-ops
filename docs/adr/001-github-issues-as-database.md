# ADR 001 — Use GitHub Issues as the primary data store

**Date:** 2026-03-13
**Status:** Accepted
**Deciders:** @samrat-dt

---

## Context

We need a data store for pipeline items (deals, candidates, accounts, investors, partners). Requirements:
- Structured fields (name, stage, numeric values, dates, enums)
- Audit trail (who changed what, when)
- Accessible via API
- Low/zero cost at beta scale
- Human-readable without a special tool

## Decision

Use GitHub Issues as the data store.

- Each pipeline item = one GitHub Issue
- Stage = a `stage:*` label on the issue
- Field values = structured markdown in the issue body (`- **field_name:** value`)
- Activity log = comments on the issue
- Assignment = GitHub issue assignees

## Consequences

**Positive:**
- Zero infrastructure cost (free GitHub plan covers this)
- Full audit trail built in (GitHub tracks every label change, comment, edit)
- API is stable, well-documented, and has excellent client libraries (`@octokit/rest`)
- Human-readable in the GitHub UI — stakeholders can browse the pipeline in GitHub directly
- Issues are searchable, filterable, and linkable

**Negative:**
- No relational queries (can't do `JOIN` or complex `WHERE`)
- Field values are stored in markdown text, parsed by regex — brittle if manually edited
- GitHub API rate limit: 5000 requests/hour authenticated (sufficient for beta)
- No schema enforcement at the database level — invalid field values won't be rejected

## Alternatives Considered

- **Postgres**: Full relational power but requires hosting, cost, migrations. Overkill for < 500 items.
- **Airtable API**: Has a GUI but vendor lock-in, API changes, cost at scale.
- **JSON files in git**: Version-controlled but no API, no concurrent access, no UI.
