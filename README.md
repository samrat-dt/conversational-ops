# Conversational Ops

Replace spreadsheet-based operational workflows with a conversational system. GitHub Issues are the database, YAML is the schema, the LLM parses intent, and the interface is CLI, Slack, or Web — your choice.

**Core principle:** GitHub = database · YAML = schema · LLM = parser · CLI/Slack/Web = UI

```
┌──────────────────────────────────────────────────────────────────┐
│  INTERFACES                                                        │
│  CLI (npx tsx src/cli.ts)   Slack (#sales-ops)   Web (Vercel)    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│  RAILWAY (persistent Node.js)                                      │
│  Express API  +  Slack Bolt (Socket Mode)                         │
│  ↕ Agent (LLM tool-calling loop)                                  │
└─────────────────────┬─────────────────────┬──────────────────────┘
                      ↓                     ↓
              GitHub Issues             Groq API
              (data store)            (LLM inference)
```

---

## Quick Start — CLI

```bash
git clone https://github.com/samrat-dt/conversational-ops
cd conversational-ops
npm install
cp .env.example .env      # fill in GROQ_API_KEY_1 and GITHUB_TOKEN
npx tsx src/cli.ts --config templates/sales.yaml
```

Single-shot mode:
```bash
npx tsx src/cli.ts --config templates/hiring.yaml \
  --run "Add candidate Jane Doe, Senior Engineer, LinkedIn, Applied stage"
```

---

## Quick Start — Web UI

```bash
# Terminal 1: backend (API + Slack bot)
npm run dev:all

# Terminal 2: web UI
cd web && npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
# → http://localhost:3000
```

---

## Interfaces

| Interface | How to access | Best for |
|-----------|--------------|----------|
| **CLI** | `npx tsx src/cli.ts --config <template>` | Developers, power users |
| **Slack** | Invite bot to `#sales-ops`, `#hiring-ops`, etc. | Teams already in Slack |
| **Web UI** | Vercel deployment (see deployment guide) | Non-technical users, dashboards |

---

## Available Pipeline Templates

| Template | Use Case | Key Fields |
|----------|----------|-----------|
| `sales.yaml` | B2B sales pipeline | value, probability, close_date, source |
| `hiring.yaml` | Recruiting tracker | role, source, years_experience, expected_salary |
| `customer-success.yaml` | CS account management | arr, health_score, tier, nps_score |
| `investor.yaml` | Fundraising tracker | check_size, fund_name, thesis_fit |
| `partnership.yaml` | Business development | partner_type, estimated_revenue, contract_value |

---

## Example Commands (any interface)

```
Add deal "Acme Corp" worth 50000 at Demo stage, 60% probability
List all open deals
Move deal #5 to Negotiation stage
Log a call on #3: "Great meeting, sending proposal tomorrow"
Run weighted_pipeline calculation
Show the full pipeline report
Flag accounts with no activity in 14 days
```

---

## Available Tools (LLM-callable)

| Tool | Description |
|------|-------------|
| `create_item` | Create a pipeline item (GitHub Issue + stage label) |
| `update_item` | Change stage, fields, or owner on an existing item |
| `list_items` | Query by stage, owner, or staleness |
| `log_activity` | Add a comment (call log, meeting note, status update) |
| `calculate` | Run a named formula from config across all items |
| `report` | Generate full ASCII dashboard with stage counts + metrics |
| `help` | List stages, fields, and example commands for current pipeline |

---

## Slack — Channel-per-Pipeline

The bot reads **all messages** in mapped channels. An LLM classification step decides: ops action or casual chat?

- **Action** → agent runs → reply in thread
- **Casual** → 👀 reaction → silence

```
Slack Workspace
├── #sales-ops          → templates/sales.yaml
├── #hiring-ops         → templates/hiring.yaml
├── #cs-ops             → templates/customer-success.yaml
├── #investor-ops       → templates/investor.yaml
└── #partnerships-ops   → templates/partnership.yaml
```

Configure via env var: `CHANNEL_MAP=sales-ops:sales,hiring-ops:hiring,...`

---

## Creating a Custom Template

```yaml
name: My Pipeline
github:
  owner: ${GITHUB_OWNER}
  repo: ${GITHUB_REPO}
fields:
  - name: value
    type: number        # string | number | date | enum
    required: true
stages:
  - name: Lead
    label: stage:lead
    probability: 0.1
calculations:
  - name: total_value
    description: Sum of all values
    formula: value
    aggregate: sum      # sum | average | count | percent
reports:
  - name: Dashboard
    calculations: [total_value]
staleness:
  days: 7
  action: comment       # comment | label
  message: "Follow up needed"
```

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for the full step-by-step guide.

**Short version:**
- **Railway** — connects GitHub repo, auto-deploys via `railway.toml`. Runs Slack bot + Express API.
- **Vercel** — import repo, set Root Directory = `web/`, set `NEXT_PUBLIC_API_URL`. Runs the web UI.

Cost: ~$0–5/month total.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY_1` | Yes | Groq API key |
| `GROQ_API_KEY_2..N` | No | Additional keys (round-robin rotation) |
| `GITHUB_TOKEN` | Yes | GitHub PAT (repo + issues scopes) |
| `GITHUB_OWNER` | Yes | GitHub username/org for template interpolation |
| `GITHUB_REPO` | Yes | GitHub repo name |
| `GROQ_MODEL` | No | Model ID (default: `llama-3.3-70b-versatile`) |
| `SLACK_BOT_TOKEN` | Slack only | Bot OAuth token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Slack only | App-level token (`xapp-...`) |
| `CHANNEL_MAP` | No | Override channel→template mapping |
| `PORT` | No | Express API port (default: 3001) |
| `WEB_ORIGIN` | No | CORS origin for web UI |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20+ / TypeScript | Type safety, npm ecosystem |
| LLM | Groq via OpenAI-compatible SDK | ~300ms inference, swap-friendly |
| GitHub | `@octokit/rest` | Stable, full-featured |
| Config | `js-yaml` | Human-editable schema |
| CLI | Node.js `readline` | Zero dependencies |
| Slack | `@slack/bolt` Socket Mode | Persistent connection, no timeout |
| Web | Next.js 15 + Tailwind | Vercel-native, fast to build |
| API | Express + SSE | Streaming agent responses |
| Tests | Vitest | Fast, ESM-native |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [`CLAUDE.md`](CLAUDE.md) | Full architecture, enforcement rules, env vars |
| [`docs/journey.md`](docs/journey.md) | Build story, phase-by-phase decisions |
| [`docs/trade-offs.md`](docs/trade-offs.md) | Every major trade-off with alternatives |
| [`docs/deployment.md`](docs/deployment.md) | Step-by-step Railway + Slack + Vercel setup |
| [`docs/roadmap-multi-tenant.md`](docs/roadmap-multi-tenant.md) | Next phase: per-client isolation |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (001–005) |

---

## Tests

```bash
npm test                                      # all 18 tests
npx vitest run tests/config-loader.test.ts   # YAML parsing
npx vitest run tests/calculator.test.ts      # formula evaluation
npx vitest run tests/agent.test.ts           # agent + tool dispatch
```
