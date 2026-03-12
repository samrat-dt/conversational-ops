# Build Journey — Conversational Ops

> The full story of why this was built, how the thinking evolved, and what happened at each phase.

---

## The Problem

Operations teams at early-stage startups live in spreadsheets.

Sales pipelines in Google Sheets. Hiring trackers in Airtable. Customer success health scores in Notion. Investor lists in Excel. Partnerships in whatever the last person used. Each one needs someone to remember to update it, someone to format it, someone to build the formulas. And none of them talk to each other.

The cost isn't the software — it's the **behavioral overhead**. People don't update the CRM because the CRM requires 12 clicks and a dropdown. They don't track hiring pipeline because the spreadsheet is in a folder no one can find. The data rots. Decisions get made on stale information.

The question was: **what if the interface was just language?**

---

## The Insight

Three observations converged:

1. **GitHub Issues are a surprisingly good database.** They have titles, bodies, labels, comments, assignees, timestamps, and a full audit trail. They're free, versioned, searchable, and API-accessible. Every developer already understands them.

2. **LLMs are good at structured extraction.** "Add deal Acme Corp worth $50k at Demo stage, 60% probability, close end of Q1" → `{ title: "Acme Corp", stage: "Demo", fields: { value: 50000, probability: 0.6, close_date: "2025-03-31" } }`. This is the core unlock.

3. **YAML is a good schema language for non-engineers.** A sales ops person can read and edit a YAML file that says `stages: [Lead, Qualified, Demo, Negotiation, Closed Won]`. They cannot edit a database schema or write a TypeScript interface.

The architecture that emerged from these three: **GitHub = database. YAML = schema. LLM = parser. CLI/Slack/Web = UI.**

---

## Phase 1: The Skeleton (Day 1)

The first version was a pure CLI.

```
npx tsx src/cli.ts --config templates/sales.yaml
> Add deal "Acme Corp" worth 50000 at Demo stage
✅ Created #1: "Acme Corp" in Demo stage
```

**Key decisions made in Phase 1:**

- **Groq over OpenAI** — latency matters for a CLI. Groq's inference is 5-10x faster than OpenAI at the time of writing. For a conversational interface, the difference between 800ms and 3s per turn is enormous UX-wise.
- **Multi-key rotation from day 1** — Groq free tier has aggressive rate limits. Rather than hit a wall mid-demo, round-robin key rotation across `GROQ_API_KEY_1..N` was built in from the start.
- **OpenAI SDK pointed at Groq base URL** — instead of the Groq SDK, we use the OpenAI npm package with `baseURL: 'https://api.groq.com/openai/v1'`. This means zero vendor lock-in. Switching to OpenAI, Together AI, Fireworks, or any OpenAI-compatible provider is one env var change.
- **Tool-calling architecture** — the LLM doesn't generate free text that we parse; it calls typed functions. This makes the output deterministic and debuggable. If something goes wrong, you can see exactly which tool was called with exactly which arguments.

**What was hard:** Getting the issue body format right so the calculator could reliably parse field values back out of markdown. Settled on `- **field_name:** value` which is both human-readable and regex-parseable.

---

## Phase 2: The YAML Config System

Five use-case templates were built:

| Template | Key use case | Key fields |
|----------|-------------|-----------|
| `sales.yaml` | B2B sales pipeline | value, probability, close_date |
| `hiring.yaml` | Recruiting tracker | role, source, years_experience |
| `customer-success.yaml` | CS account management | arr, health_score, tier |
| `investor.yaml` | Fundraising rounds | check_size, thesis_fit, stage_focus |
| `partnership.yaml` | Business development | partner_type, estimated_revenue |

**Design trade-off: YAML vs code vs database**

Three options were considered for the schema layer:

| Option | Pros | Cons |
|--------|------|------|
| YAML config files | Human-editable, version-controlled, no deploy needed | Limited expressiveness, no migrations |
| TypeScript config objects | Type-safe, IDE support | Requires code change + deploy to change schema |
| Database (Postgres, SQLite) | Full relational power | Overkill, requires infra, another thing to maintain |

**Chose YAML** because the primary users modifying the schema are non-engineers (ops people), the configs are small and change infrequently, and the overhead of a real DB for what is essentially a 20-field form is unjustifiable at this stage.

**Environment variable interpolation in YAML** (`${GITHUB_OWNER}`) was added so the same template file works across repos without modification. The loader replaces vars at parse time.

---

## Phase 3: Slack Integration

The CLI is useful for developers. Beta testers wanted Slack.

**Architecture considered:**

```
Option A: @mentions with command prefix
  User: @ops-bot add deal Acme Corp $50k
  Pro: Explicit, zero false positives
  Con: Friction. Users have to remember the syntax.

Option B: Dedicated channels, reads ALL messages  ← chosen
  User: "just got off a call with Acme, they want to move forward"
  Bot: ✅ Created #42: "Acme Corp" in Demo stage
  Pro: Zero friction. Natural language. Truly conversational.
  Con: Must classify every message (adds ~200ms LLM call)
```

**Chose Option B** — the 200ms classification cost is worth it for the UX gain. The experience of just talking into a channel and having the pipeline update itself is the whole point.

**Channel-to-config mapping:** Channels are mapped to pipeline configs. `#sales-ops` loads `sales.yaml`. This means the channel itself provides the context — no bot mention, no prefix, no syntax to remember.

**Silent non-actions:** When the bot classifies a message as non-action (casual chat), it reacts with 👀 to show it's alive and paying attention, but doesn't respond. This is important — a bot that replies to every message would be noisy and annoying.

**Thread replies:** All bot responses go into the message's thread, not into the channel. This keeps the channel clean. The conversation between a user and the bot is contained in a thread.

**Deployment: Railway over Fly.io**

| Option | Why considered | Why not chosen |
|--------|---------------|----------------|
| Vercel | Already using for web, easy deploys | Serverless timeout (10s). Slack Socket Mode needs persistent connection. |
| Fly.io | Good Node.js support, global edge | More complex config, more expensive for a single small service |
| Railway | Persistent process, auto-deploy from GitHub, simple pricing | — (chosen) |
| Self-hosted (EC2/DO) | Cheapest long-term | Operational overhead. Not worth it for beta. |

Railway's `railway.toml` deploys on every push to `main`. The persistent process handles both the Slack bot and the Express API.

---

## Phase 4: Web UI

The web UI serves a different audience than Slack — people who want a dedicated interface rather than working in a chat app.

**Stack choices:**

- **Next.js 15 App Router** — React with server components, API routes, and streaming support. The alternative was a plain React SPA + Express static serve, but Next.js gives better DX and Vercel deployment is literally zero-config.
- **Tailwind CSS** — Fast to write, consistent dark theme. The alternative was CSS modules or styled-components but for a focused internal tool, Tailwind's utility classes are faster.
- **SSE over WebSockets** — Agent responses are streamed via Server-Sent Events. WebSockets add bidirectional complexity we don't need. SSE is simpler to implement and sufficient for one-direction streaming (server → client).
- **Session storage for conversation history** — Each browser tab gets a UUID (stored in `sessionStorage`). The Express server maps `sessionId + pipelineId` to an `Agent` instance in memory. This means:
  - History persists within a tab session
  - Tabs are isolated from each other
  - History is lost on server restart (acceptable for beta)

**The sidebar design decision:** The sidebar shows live stage counts (polling the GitHub API via the items endpoint). This was an early design question — should the dashboard be real-time? The answer: no. Polling on page load is sufficient. The pipeline doesn't change every second. Real-time would add WebSocket complexity for zero user benefit.

---

## What's Next

- **Auth** — right now the web UI is open to anyone with the URL. For beta, that's fine. For production, add NextAuth or a simple magic-link system.
- **Notifications** — Slack already handles this for Slack users. For web users, browser notifications when items go stale.
- **Multi-repo support** — right now each config points to one GitHub repo. Supporting multiple repos per user would require auth + user-specific configs.
- **Streaming tool call progress** — the agent runs silently until it has a final answer. Streaming intermediate tool call status ("Creating issue...", "Applying label...") to the UI is implemented for status messages but could be more granular.
- **Mobile web** — the current web UI is desktop-only. A responsive layout would make it usable on phone for quick pipeline updates.
