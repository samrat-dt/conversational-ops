# ADR 003 — Slack channel-per-pipeline with autonomous classification

**Date:** 2026-03-13
**Status:** Accepted
**Deciders:** @samrat-dt

---

## Context

We need a Slack interface for beta testers. Key question: how does the bot know when to act?

## Decision

One dedicated Slack channel per pipeline. The bot reads **all** messages in mapped channels. A fast LLM classification call determines whether each message is an ops action. If yes, run the agent and reply in thread. If no, react with 👀 and stay silent.

```
#sales-ops      → loads templates/sales.yaml
#hiring-ops     → loads templates/hiring.yaml
#cs-ops         → loads templates/customer-success.yaml
#investor-ops   → loads templates/investor.yaml
#partnerships-ops → loads templates/partnership.yaml
```

Channel → config mapping is configurable via `CHANNEL_MAP` env var.

## Consequences

**Positive:**
- Zero friction for users — they type naturally, the bot understands
- The channel provides context (which pipeline) without any command syntax
- Casual conversation is handled gracefully (👀 reaction, no noise)
- Per-channel conversation history means pronouns work ("update that last deal")

**Negative:**
- Every message incurs a classification LLM call (~200ms, ~$0.0001)
- Per-channel agent instances hold history in memory — lost on restart
- Bot must have `channels:history` scope on every monitored channel
- Classification can fail on very ambiguous messages

## Alternative Considered

**@mention with prefix** (`@ops-bot add deal Acme...`)
- Pro: No classification cost, explicit intent
- Con: Users must remember syntax, friction defeats the conversational purpose
- Rejected: The zero-friction UX is the core value proposition

## Socket Mode Choice

Socket Mode (WebSocket) rather than HTTP webhooks because:
- Agent processing (LLM + GitHub) can take 3-8s
- Slack HTTP webhooks require 3s acknowledgment — not reliably achievable
- Socket Mode allows async acknowledgment, no timeout risk
- No public HTTPS URL required (simpler Railway/local deployment)
