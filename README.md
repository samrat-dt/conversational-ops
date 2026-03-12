# Conversational Ops

Replace spreadsheet-based operational workflows with a conversational CLI agent. GitHub Issues are the database, YAML is the schema, the LLM parses intent, and the CLI is the UI.

```
┌──────────────┐     natural language      ┌──────────────┐
│   You (CLI)  │ ────────────────────────▶ │   LLM Agent  │
│              │ ◀──────────────────────── │   (Groq)     │
└──────────────┘     structured response   └──────┬───────┘
                                                  │ tool calls
                                           ┌──────▼───────┐
                                           │  GitHub API  │
                                           │  (Issues)    │
                                           └──────────────┘
```

## Quick Start

```bash
git clone https://github.com/samrat-dt/conversational-ops
cd conversational-ops
npm install
cp .env.example .env       # Fill in GROQ_API_KEY_1 and GITHUB_TOKEN
```

Start a pipeline REPL:
```bash
npx tsx src/cli.ts --config templates/sales.yaml
```

Or run a single command:
```bash
npx tsx src/cli.ts --config templates/hiring.yaml --run "Add candidate Jane Doe for Senior Engineer, source LinkedIn, stage Applied"
```

## Available Templates

| Template | Use Case | Key Fields |
|----------|----------|-----------|
| `sales.yaml` | B2B sales pipeline | value, probability, close_date, source |
| `hiring.yaml` | Recruiting tracker | role, source, years_experience, expected_salary |
| `customer-success.yaml` | CS account management | arr, health_score, tier, nps_score |
| `investor.yaml` | Fundraising tracker | check_size, fund_name, thesis_fit |
| `partnership.yaml` | Partnership pipeline | partner_type, estimated_revenue, contract_value |

## Example Commands

```
> Add deal "Acme Corp" worth 50000 at Demo stage, 60% probability
> List all open deals
> Move deal #5 to Negotiation stage
> Log a call on deal #3: "Great meeting, sending proposal tomorrow"
> Run weighted_pipeline calculation
> Show the full pipeline report
> Flag accounts with no activity in 14 days
```

## Available Tools

| Tool | Description |
|------|-------------|
| `create_item` | Create a new pipeline item (GitHub Issue + labels) |
| `update_item` | Change stage, fields, or owner on an existing item |
| `list_items` | Query items by stage, owner, or staleness |
| `log_activity` | Add a comment (call log, meeting note, status update) |
| `calculate` | Run a named formula from config on current items |
| `report` | Generate a full ASCII dashboard summary |
| `help` | List available stages, fields, and example commands |

## Creating Your Own Template

1. Copy an existing template: `cp templates/sales.yaml templates/my-use-case.yaml`
2. Edit the YAML to define your fields, stages, calculations, and reports
3. Run: `npx tsx src/cli.ts --config templates/my-use-case.yaml`

### Template Structure

```yaml
name: My Pipeline
github:
  owner: ${GITHUB_OWNER}      # uses .env value
  repo: ${GITHUB_REPO}

fields:
  - name: value
    type: number               # string | number | date | enum
    required: true
  - name: status
    type: enum
    options: [Hot, Warm, Cold]
    required: false

stages:
  - name: Lead
    label: stage:lead          # applied as GitHub label
    probability: 0.1           # optional, for weighted calculations

calculations:
  - name: total_value
    description: Sum of all deal values
    formula: value             # field expressions, e.g. "value * probability"
    aggregate: sum             # sum | average | count | percent

reports:
  - name: My Dashboard
    calculations: [total_value]

staleness:
  days: 7
  action: comment              # comment | label
  message: "Follow up needed"
```

## Staleness Checker

Run the staleness check standalone:
```bash
npx tsx -e "
import 'dotenv/config';
import { loadConfig } from './src/config/loader.js';
import { runStalenessCheck } from './src/scheduler/index.js';
const config = loadConfig('./templates/customer-success.yaml');
await runStalenessCheck(config);
"
```

## Development

```bash
npm test              # Run all tests
npm run typecheck     # TypeScript type check
npm run build         # Compile to dist/
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY_1` | Groq API key (required) |
| `GROQ_API_KEY_2..N` | Additional keys for rotation (optional) |
| `GITHUB_TOKEN` | GitHub PAT with `repo` and `issues` scopes |
| `GITHUB_OWNER` | Default GitHub owner for template interpolation |
| `GITHUB_REPO` | Default GitHub repo for template interpolation |
| `GROQ_MODEL` | Groq model ID (default: `llama-3.3-70b-versatile`) |

## Tech Stack

- **Runtime:** Node.js 20+ / TypeScript
- **LLM:** Groq (via OpenAI-compatible SDK) with multi-key rotation
- **GitHub:** `@octokit/rest`
- **Config:** `js-yaml`
- **CLI:** Node.js `readline` REPL
- **Tests:** Vitest
