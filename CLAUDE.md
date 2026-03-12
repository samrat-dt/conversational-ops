# CLAUDE.md — Conversational Ops

## Project Overview

Conversational operations system that replaces spreadsheet-based workflows with GitHub Issues as a structured data store, managed via a CLI, Slack bot, and Web UI — all backed by an LLM (Groq).

**Core principle:** GitHub = database. YAML = schema. LLM = parser. CLI/Slack/Web = UI.

## Full Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                              │
│                                                                       │
│  CLI (src/cli.ts)         Slack (#sales-ops)      Web (web/)         │
│  npx tsx src/cli.ts        reads ALL messages      Next.js 15        │
│  --config sales.yaml       channel → config        Vercel            │
└────────────┬───────────────────────┬──────────────────┬─────────────┘
             │                       │                  │
             └───────────────────────┼──────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────┐
│  RAILWAY (persistent Node.js — src/start.ts)                         │
│                                                                       │
│  ┌─────────────────────────┐   ┌──────────────────────────────────┐  │
│  │  Slack Bolt (Socket)    │   │  Express API                     │  │
│  │  handler.ts             │   │  POST /api/chat (SSE stream)     │  │
│  │  channel → config       │   │  GET  /api/configs               │  │
│  │  classify → agent       │   │  GET  /api/pipeline/:c/items     │  │
│  │  thread reply           │   │  POST /api/reset                 │  │
│  └────────────┬────────────┘   └────────────────┬─────────────────┘  │
│               └──────────────┬─────────────────┘                    │
│                               │                                      │
│  ┌────────────────────────────▼──────────────────────────────────┐  │
│  │  Agent Orchestrator (src/agent/index.ts)                       │  │
│  │  user input → LLM → tool calls → tool results → LLM → output │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐ │  │
│  │  │ prompt-builder│  │ tool-registry   │  │  7 tools         │ │  │
│  │  │ system prompt │  │ name → handler  │  │  create/update/  │ │  │
│  │  └──────────────┘  └─────────────────┘  │  list/log/calc/  │ │  │
│  │                                          │  report/help     │ │  │
│  └──────────────────────────────────────────┴──────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────▼──────────────────────────────────┐  │
│  │  LLM Client (Groq via OpenAI SDK)   GitHub Client (Octokit)   │  │
│  │  key-rotation.ts (round-robin)      issues / labels / comments │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
     GitHub Issues                           Groq API
     (data store)                          (LLM inference)
```

## Directory Structure

```
conversational-ops/
├── CLAUDE.md                    ← You are here
├── README.md
├── railway.toml                 ← Railway deployment config
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── src/
│   ├── cli.ts                   # REPL entry point
│   ├── start.ts                 # Combined Railway entry (Express + Slack)
│   │
│   ├── agent/
│   │   ├── index.ts             # Orchestrator loop (LLM + tool dispatch)
│   │   ├── prompt-builder.ts    # System prompt from config
│   │   └── tool-registry.ts     # Tool name → handler map
│   │
│   ├── llm/
│   │   ├── client.ts            # Groq (OpenAI-compat) with retry
│   │   ├── key-rotation.ts      # Round-robin GROQ_API_KEY_1..N
│   │   └── types.ts             # LLMMessage, ToolCall, LLMResponse
│   │
│   ├── github/
│   │   ├── client.ts            # Octokit singleton
│   │   ├── issues.ts            # CRUD for issues
│   │   ├── labels.ts            # Label management
│   │   └── comments.ts          # Comment operations
│   │
│   ├── tools/                   # LLM-callable tools (OpenAI function format)
│   │   ├── create-item.ts       # create_item
│   │   ├── update-item.ts       # update_item
│   │   ├── list-items.ts        # list_items
│   │   ├── log-activity.ts      # log_activity
│   │   ├── calculate.ts         # calculate
│   │   └── report.ts            # report
│   │
│   ├── config/
│   │   ├── loader.ts            # YAML load + env interpolation + validation
│   │   └── types.ts             # PipelineConfig, Field, Stage, Calculation, Report
│   │
│   ├── slack/
│   │   ├── app.ts               # Standalone Slack bot entry point
│   │   ├── handler.ts           # message → classify → agent → thread reply
│   │   └── channel-map.ts       # #channel → templates/X.yaml mapping
│   │
│   └── server/
│       └── index.ts             # Express API (used by web UI)
│
├── templates/                   # Plug-and-play pipeline configs
│   ├── sales.yaml
│   ├── hiring.yaml
│   ├── customer-success.yaml
│   ├── investor.yaml
│   └── partnership.yaml
│
├── web/                         # Next.js 15 web UI (deployed to Vercel)
│   ├── package.json
│   ├── next.config.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Redirects to /sales
│   │   └── [pipeline]/page.tsx  # Main pipeline page
│   ├── components/
│   │   ├── Sidebar.tsx          # Pipeline nav + stage bar charts
│   │   └── ChatPanel.tsx        # SSE chat + suggestion chips
│   └── lib/
│       └── api.ts               # Fetch wrappers for Railway API
│
├── tests/
│   ├── calculator.test.ts
│   ├── config-loader.test.ts
│   └── agent.test.ts
│
└── docs/
    ├── journey.md               # Build story + decisions
    ├── trade-offs.md            # All trade-offs considered
    └── adr/                     # Architecture Decision Records
        ├── 001-github-issues-as-database.md
        ├── 002-groq-openai-compatible-llm.md
        ├── 003-slack-channel-per-pipeline.md
        ├── 004-deployment-railway-vercel.md
        └── 005-yaml-config-as-schema.md
```

## Database Schema (GitHub Issues)

```
Issue Title:   <item name>
Issue Labels:  stage:<stage-name>   [one per issue]
               stale                [if staleness check fires]
Issue Body:
  ## <Pipeline Name> Item

  **Stage:** <stage name>
  **Owner:** @<github-username>

  ### Fields
  - **field_name:** value    ← parsed by calculate tool via regex

Issue Comments:  Activity log (calls, meetings, notes, updates)
Issue Assignees: Pipeline owners/reps
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY_1` | Yes | First Groq API key |
| `GROQ_API_KEY_2..N` | No | Additional keys for rotation |
| `GITHUB_TOKEN` | Yes | GitHub PAT (repo + issues scopes) |
| `GITHUB_OWNER` | No | Default owner for `${GITHUB_OWNER}` in templates |
| `GITHUB_REPO` | No | Default repo for `${GITHUB_REPO}` in templates |
| `GROQ_MODEL` | No | Model ID (default: llama-3.3-70b-versatile) |
| `SLACK_BOT_TOKEN` | No | Slack bot token (xoxb-...) |
| `SLACK_APP_TOKEN` | No | Slack app-level token (xapp-...) |
| `CHANNEL_MAP` | No | `chan:template,chan:template` override |
| `PORT` | No | Express API port (default: 3001) |
| `WEB_ORIGIN` | No | Allowed CORS origin for the web UI |

## Deployment

| Service | What | Command |
|---------|------|---------|
| Railway | Slack bot + Express API | Auto-deploy via `railway.toml` on push |
| Vercel | Next.js web UI | Auto-deploy via Vercel GitHub integration |

## Enforcement Rules (MANDATORY)

**After every action or change:**
1. Update this CLAUDE.md if architecture, directory structure, or design decisions change
2. Update `README.md` if setup instructions or CLI usage changes
3. Update `docs/journey.md` with what changed and why
4. Write an ADR in `docs/adr/` for any significant new decision
5. Update `docs/trade-offs.md` if a trade-off is resolved or a new one accepted
6. Add/update tests if tool logic changes

**When adding a new tool:**
1. Create `src/tools/<tool-name>.ts` with definition + handler
2. Register in `src/agent/tool-registry.ts`
3. Update tools table in `README.md`
4. Add test case

**When adding a new template:**
1. Place in `templates/<name>.yaml`
2. Add to templates table in `README.md`
3. Add test case in `tests/config-loader.test.ts`
4. Add default mapping in `src/slack/channel-map.ts`

**When changing the config schema (`PipelineConfig`):**
1. Update `src/config/types.ts`
2. Update `src/config/loader.ts` validation
3. Update all 5 templates if needed
4. Update ADR 005

## Running Locally

```bash
# Backend (Slack + API)
cp .env.example .env
npm install
npm run dev:all     # Express API + Slack bot

# Web UI (separate terminal)
cd web
cp .env.local.example .env.local
npm install
npm run dev         # http://localhost:3000
```

## Running Tests

```bash
npm test
npx vitest run tests/config-loader.test.ts
npx vitest run tests/calculator.test.ts
npx vitest run tests/agent.test.ts
```
