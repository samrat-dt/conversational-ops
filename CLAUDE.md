# CLAUDE.md — Conversational Ops

## Project Overview

Conversational operations system that replaces spreadsheet-based workflows with GitHub Issues as a structured data store, managed via a CLI conversational agent backed by an LLM (Groq).

**Core principle:** GitHub = database. YAML = schema. LLM = parser. CLI = UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI (src/cli.ts)                        │
│   --config templates/X.yaml    [--run "single shot command"]     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Agent Orchestrator (src/agent/index.ts)       │
│                                                                  │
│   ┌────────────────┐    ┌─────────────────┐                     │
│   │ prompt-builder │    │ tool-registry   │                     │
│   │ (system prompt)│    │ (name→handler)  │                     │
│   └────────────────┘    └─────────────────┘                     │
└──────────────┬──────────────────────┬──────────────────────────┘
               │                      │
┌──────────────▼──────────┐  ┌───────▼──────────────────────────┐
│   LLM Client (Groq)     │  │   Tools (src/tools/)             │
│                         │  │                                   │
│  ┌─────────────────┐    │  │  create-item   update-item       │
│  │ key-rotation.ts │    │  │  list-items    log-activity      │
│  │ (round-robin)   │    │  │  calculate     report            │
│  └─────────────────┘    │  │  help                            │
└─────────────────────────┘  └──────────────┬───────────────────┘
                                            │
                             ┌──────────────▼──────────────────┐
                             │   GitHub Client (Octokit)        │
                             │                                  │
                             │  issues.ts  labels.ts           │
                             │  comments.ts  client.ts         │
                             └──────────────────────────────────┘
```

## Directory Structure

```
conversational-ops/
├── CLAUDE.md                   ← You are here
├── README.md
├── .env.example                ← Copy to .env and fill in keys
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── src/
│   ├── cli.ts                  # REPL entry point
│   ├── agent/
│   │   ├── index.ts            # Orchestrator loop
│   │   ├── prompt-builder.ts   # System prompt generation
│   │   └── tool-registry.ts    # Tool name → handler map
│   ├── llm/
│   │   ├── client.ts           # Groq (OpenAI-compat) wrapper
│   │   ├── key-rotation.ts     # Round-robin key manager
│   │   └── types.ts            # LLMMessage, ToolCall, etc.
│   ├── github/
│   │   ├── client.ts           # Octokit singleton
│   │   ├── issues.ts           # CRUD for issues
│   │   ├── labels.ts           # Label management
│   │   └── comments.ts         # Comment operations
│   ├── tools/                  # LLM-callable tools
│   │   ├── create-item.ts
│   │   ├── update-item.ts
│   │   ├── list-items.ts
│   │   ├── log-activity.ts
│   │   ├── calculate.ts
│   │   └── report.ts
│   ├── config/
│   │   ├── loader.ts           # YAML load + validation
│   │   └── types.ts            # PipelineConfig type definitions
│   └── scheduler/
│       └── index.ts            # Staleness checker
│
├── templates/                  # Plug-and-play use-case configs
│   ├── sales.yaml
│   ├── hiring.yaml
│   ├── customer-success.yaml
│   ├── investor.yaml
│   └── partnership.yaml
│
└── tests/
    ├── calculator.test.ts
    ├── config-loader.test.ts
    └── agent.test.ts
```

## Database Schema (GitHub Issues)

Each pipeline item is a GitHub Issue with:

```
Title:  <item name>          ← Searchable, display name
Labels: stage:<stage-name>   ← Current stage; also "stale" if flagged
Body:   ## <Config Name> Item
        **Stage:** <stage>
        **Owner:** @<username>

        ### Fields
        - **field_name:** value    ← Parsed by calculate tool

Comments: Activity log (calls, meetings, notes, status updates)
```

## Key Design Decisions

1. **GitHub Issues as DB** — No external DB. Issues are the source of truth.
2. **Body parsing for fields** — Field values live in the issue body as markdown. The `calculate` tool uses regex to extract them.
3. **Label-based stage tracking** — Stages are `stage:*` labels. Only one stage label per issue.
4. **OpenAI-compatible SDK on Groq** — Using the `openai` npm package pointed at Groq's base URL.
5. **Key rotation** — Round-robin across `GROQ_API_KEY_1..N` with auto-rotate on 429.

## Enforcement Rules (MANDATORY)

**After every action or change:**
1. Update this CLAUDE.md if the architecture, directory structure, or design decisions change
2. Update README.md if setup instructions or CLI usage changes
3. Update `src/config/types.ts` if the config schema changes
4. Add/update tests if tool logic changes

**When adding a new tool:**
1. Create `src/tools/<tool-name>.ts` with definition + handler
2. Register it in `src/agent/tool-registry.ts`
3. Update the tools table in README.md

**When adding a new template:**
1. Place it in `templates/<name>.yaml`
2. Add it to the templates table in README.md
3. Add a test case in `tests/config-loader.test.ts`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY_1` | Yes | First Groq API key |
| `GROQ_API_KEY_2..N` | No | Additional keys for rotation |
| `GITHUB_TOKEN` | Yes | GitHub PAT (repo + issues scopes) |
| `GITHUB_OWNER` | No | Default GitHub owner (used in template `${GITHUB_OWNER}`) |
| `GITHUB_REPO` | No | Default GitHub repo |
| `GROQ_MODEL` | No | Model ID (default: llama-3.3-70b-versatile) |

## Running Locally

```bash
cp .env.example .env       # Fill in your keys
npm install
npx tsx src/cli.ts --config templates/sales.yaml
```

## Running Tests

```bash
npm test                   # All tests
npx vitest run tests/config-loader.test.ts
npx vitest run tests/calculator.test.ts
npx vitest run tests/agent.test.ts
```
