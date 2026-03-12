# ADR 002 — Use Groq via OpenAI-compatible SDK with key rotation

**Date:** 2026-03-13
**Status:** Accepted
**Deciders:** @samrat-dt

---

## Context

We need an LLM provider for:
1. Intent parsing (natural language → structured tool calls)
2. Intent classification (is this an ops action?)
3. Response generation

Key requirements: low latency (conversational UX), low cost (beta/free tier), tool-calling support.

## Decision

Use Groq as the LLM provider, accessed via the `openai` npm package pointed at Groq's base URL.

```typescript
const client = new OpenAI({
  apiKey: groqApiKey,
  baseURL: 'https://api.groq.com/openai/v1'
});
```

Support `GROQ_API_KEY_1..N` environment variables with round-robin rotation. On HTTP 429, automatically rotate to the next key.

Default model: `llama-3.3-70b-versatile`

## Consequences

**Positive:**
- Groq's inference speed (~300ms) makes the CLI and Slack bot feel instant
- Using the OpenAI SDK means zero vendor lock-in — swap to any OpenAI-compatible provider by changing `baseURL` and `apiKey`
- Key rotation provides horizontal scaling of free tier rate limits
- `llama-3.3-70b-versatile` has excellent tool-calling support and follows system prompts accurately

**Negative:**
- Groq free tier has aggressive rate limits (~30 req/min per key)
- Groq reliability is lower than OpenAI (occasional 5xx errors in heavy usage)
- `llama-3.3-70b` occasionally misparses ambiguous field values (e.g., "50k" as 50 instead of 50000)

## Rotation Strategy

```
GROQ_API_KEY_1, GROQ_API_KEY_2, ... GROQ_API_KEY_N
Round-robin on every call.
On 429: rotate immediately, retry up to MAX_RETRIES times.
```

## Migration Path

To switch to OpenAI:
```env
GROQ_API_KEY_1=sk-your-openai-key
GROQ_MODEL=gpt-4o-mini
# Change baseURL in src/llm/client.ts to https://api.openai.com/v1
```

To switch to local Ollama:
```env
# Change baseURL to http://localhost:11434/v1
GROQ_MODEL=llama3.2
```
