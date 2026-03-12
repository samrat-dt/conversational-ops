# Trade-offs Log

> Every significant decision in this project involved a trade-off. This document captures them all — what was considered, what was chosen, and why.

---

## 1. GitHub Issues vs a Real Database

**Decision:** Use GitHub Issues as the primary data store.

| Option | Pros | Cons |
|--------|------|------|
| GitHub Issues | Free, version-controlled, API-rich, developer-familiar, built-in audit trail | No relations, limited query power, rate limits, parsing fields from markdown is fragile |
| Postgres | Full relational power, fast queries, migrations | Requires hosting, another service to maintain, cost |
| SQLite | Embedded, zero infra | Not accessible from multiple processes/deploys |
| Airtable/Notion API | Already has GUI | Vendor lock-in, cost at scale, API instability |

**Chosen: GitHub Issues**

**Why:** At beta scale (<500 items per pipeline), GitHub Issues are completely sufficient. The query patterns are simple (list by label, filter by assignee). The API is stable and well-documented. The audit trail (every comment, label change, and edit is logged) is a feature, not a limitation. The real database can come later when the access patterns are understood.

**Known fragility:** Field values are parsed from issue body markdown using regex. If a user manually edits an issue body in GitHub and breaks the format, calculations will silently return incorrect results. This is a known trade-off accepted for the prototype.

---

## 2. LLM-based Field Extraction vs Structured Forms

**Decision:** Accept natural language input, extract structure with LLM.

| Option | Pros | Cons |
|--------|------|------|
| LLM extraction (chosen) | Zero-friction input, no form to fill | Extraction can fail or misparse, non-deterministic, API cost |
| Structured form (web UI) | Reliable, validatable, no AI cost | Friction, defeats the "conversational" purpose |
| Slash command syntax (`/add name:Acme value:50000`) | Deterministic, no API cost | Users have to learn syntax |

**Chosen: LLM extraction**

**Why:** The entire value proposition of this system is that users don't have to change how they communicate. A sales rep who types "just spoke with Acme, they're ready to move, $80k deal, closing next month" should have that reflected in the pipeline without any reformatting. The LLM failure rate on structured extraction is <5% for well-prompted models on clear inputs. Acceptable.

**Mitigation:** Tool definitions have explicit `required` fields. The LLM is forced to call the tool with the right schema, which surfaces missing fields as tool errors rather than silently bad data.

---

## 3. Groq vs OpenAI vs Other LLM Providers

**Decision:** Groq as the primary LLM provider, via the OpenAI-compatible SDK.

| Provider | Latency | Cost | Reliability | Notes |
|----------|---------|------|-------------|-------|
| Groq | ~300ms | Free tier + cheap | Good | Best for interactive use |
| OpenAI | ~1-3s | Moderate | Excellent | Industry standard |
| Anthropic Claude | ~1-2s | Moderate | Excellent | Best reasoning |
| Together AI | ~400ms | Cheap | Good | OpenAI-compat |
| Ollama (local) | Variable | Free | Depends on hardware | No cloud dependency |

**Chosen: Groq** (with easy swap path to any OpenAI-compatible provider)

**Why:** Latency is the primary UX differentiator for a conversational interface. 300ms feels instant. 2 seconds feels slow. Groq's hardware-level optimization (custom inference chips) delivers the best latency at the free tier.

**The SDK choice matters:** By using the `openai` npm package pointing at Groq's base URL instead of the Groq SDK, the provider is swappable with one env var change (`GROQ_MODEL` + base URL). No code change required.

**Key rotation:** Groq free tier rate-limits aggressively (~30 req/min per key). Supporting `GROQ_API_KEY_1..N` with round-robin rotation and automatic failover on 429 allows horizontal scaling of the free tier.

---

## 4. Slack Socket Mode vs HTTP Events

**Decision:** Socket Mode (WebSocket-based) over HTTP webhooks.

| Option | Pros | Cons |
|--------|------|------|
| Socket Mode (chosen) | No public URL needed, works locally, no ngrok | Persistent process required, slightly higher latency |
| HTTP webhooks | Standard, any deploy target | Requires public HTTPS URL, Vercel timeout issues |

**Chosen: Socket Mode**

**Why:** For a bot that makes GitHub API calls + LLM calls, the response time can be 3-8 seconds. Slack's 3-second acknowledgment requirement is unforgiving with HTTP webhooks — the bot must acknowledge within 3s or Slack retries. Socket Mode allows async acknowledgment. Also, Socket Mode doesn't require a public URL, making local development and Railway deployment simpler.

---

## 5. Intent Classification: Two-pass vs Single-pass

**Decision:** Run a fast classification LLM call before the full agent, to decide whether to process a Slack message.

| Option | Pros | Cons |
|--------|------|------|
| Always run agent (single-pass) | Simpler code, one LLM call | Wastes API calls on "hey team, stand-up in 5 minutes", agent returns unhelpful response |
| Keyword heuristics | Free, fast | Brittle, misses nuanced actions like "that Acme call went well" |
| Fast classification call (chosen) | Accurate, handles nuance | 200ms extra per message, extra API cost |

**Chosen: Two-pass** with classification

**Why:** The agent costs ~2-4 LLM calls per action (classification + tool call + final response). Skipping the classification would mean every "#hiring-ops: coffee catch-up at 3pm" triggers a full agent run that fails. The 200ms classification cost is worth the noise reduction. The classification prompt is deliberately simple: "Is this an ops action? yes/no."

---

## 6. Conversation History: Per-channel vs Per-user vs Stateless

**Decision:** Per-channel agent instance with in-memory history.

| Option | Pros | Cons |
|--------|------|------|
| Stateless (no history) | Simple, no memory leaks | "Move that deal to the next stage" doesn't work — no context |
| Per-user history | Individual context | Users in same channel can't refer to shared context |
| Per-channel history (chosen) | Shared context per pipeline, natural | History lost on restart, memory grows unbounded without TTL |
| Database-backed history | Persistent, scalable | Requires DB, adds latency |

**Chosen: Per-channel in-memory** for the Slack bot, per-sessionId in-memory for the web.

**Why:** In a channel like `#sales-ops`, the conversation is shared. "Update that last deal we added" refers to something that happened in the channel, not in a specific user's thread. Per-channel history makes pronouns work. The in-memory approach is sufficient for beta — a Railway restart clears history, which is acceptable.

---

## 7. Web UI Architecture: Next.js App Router vs SPA + API

**Decision:** Next.js App Router (Vercel-deployed) calling a Railway Express backend.

| Option | Pros | Cons |
|--------|------|------|
| Next.js + separate Express (chosen) | Clean separation, Next.js on Vercel (free), Express on Railway (persistent) | Two services to deploy, CORS config needed |
| Next.js API routes only (no Express) | One service, simpler | Vercel serverless timeouts, no persistent Slack bot |
| SPA (Vite/React) + Express | Simple | No SSR, manual routing |

**Chosen: Next.js on Vercel + Express on Railway**

**Why:** The Slack bot requires a persistent process (Railway). The web UI benefits from Vercel's CDN and zero-config Next.js deployment. Separating them means each can be scaled, debugged, and deployed independently. The CORS overhead is one env var (`WEB_ORIGIN`).

---

## 8. Streaming: SSE vs WebSockets vs Long-polling

**Decision:** Server-Sent Events (SSE) for agent response streaming.

| Option | Pros | Cons |
|--------|------|------|
| SSE (chosen) | Simple, HTTP-native, works with fetch API, uni-directional | No bidirectional, requires HTTP/1.1 |
| WebSockets | Bidirectional, real-time | More complex setup, overkill for request-response pattern |
| Long-polling | Works everywhere | High latency, wasteful |
| Wait for full response | Simplest | Poor UX for 5-8s responses |

**Chosen: SSE**

**Why:** Agent → client is the only direction that needs streaming. The user sends one message, the server streams back progress + the final response. SSE is exactly the right abstraction for this. It's simpler than WebSockets and gives better UX than waiting for the full response.

---

## 9. Field Storage: Issue Body (markdown) vs GitHub Issue Custom Fields

**Decision:** Store field values as markdown in the issue body, not GitHub's native custom fields.

| Option | Pros | Cons |
|--------|------|------|
| Markdown in body (chosen) | Works with all GitHub plans, human-readable, easy to parse | Format-sensitive, can break if manually edited |
| GitHub Projects custom fields | Native, queryable | Requires GitHub Projects V2, API complexity, not free for all orgs |
| Issue labels for values | Simple, filterable | Not suitable for numeric/date/string values |

**Chosen: Markdown in body**

**Why:** GitHub Projects custom fields are powerful but require a specific plan and add significant API complexity. For the prototype, structured markdown (`- **field_name:** value`) is sufficient and works on any GitHub plan including free. The fragility (manual edits can break parsing) is accepted as a known limitation.

---

## Known Technical Debt

| Item | Impact | Plan |
|------|--------|------|
| No history persistence (lost on restart) | Low — users re-establish context quickly | Add Redis or DB-backed history if needed |
| No auth on web UI | Medium — anyone with URL has full access | Add NextAuth or magic link for beta expansion |
| Formula evaluation uses `Function()` | Low security risk — only run server-side on operator-controlled formulas | Acceptable for now; replace with a proper expression evaluator (e.g., `mathjs`) for untrusted input |
| Per-channel agent cache has no TTL | Memory leak on Railway over time | Add LRU cache with TTL |
| No webhook support (Slack Socket Mode only) | Medium — can't deploy to true serverless | Add HTTP mode as alternative if needed |
