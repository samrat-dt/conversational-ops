# ADR 004 — Deploy Slack+API to Railway, Web UI to Vercel

**Date:** 2026-03-13
**Status:** Accepted
**Deciders:** @samrat-dt

---

## Context

Two components to deploy:
1. Slack bot (Socket Mode — needs persistent process)
2. Web UI (Next.js — static-friendly)

## Decision

**Railway:** Runs `src/start.ts` — single persistent Node.js process that hosts both the Slack Bolt app (Socket Mode) and the Express REST API.

**Vercel:** Deploys `web/` — Next.js app that calls the Railway API.

```
User browser
    ↓ HTTPS
Vercel (web/)
    ↓ fetch API calls
Railway (src/start.ts)
    ├── Express API (/api/chat, /api/configs, /api/pipeline/*)
    └── Slack Bolt (Socket Mode, WebSocket to Slack)
        ↕ GitHub API + Groq API
```

## Consequences

**Positive:**
- Railway provides the persistent process Slack Socket Mode requires
- Railway auto-deploys on push to `main` via `railway.toml`
- Vercel provides CDN, zero-config Next.js deployment, free tier
- Separation of concerns: web can be iterated/redeployed independently of backend
- Railway's `/health` endpoint enables uptime monitoring

**Negative:**
- Two services to manage instead of one
- CORS configuration needed (`WEB_ORIGIN` env var on Railway)
- Railway has cold-start if the service idles (Hobby plan sleeps after inactivity)

## Cost

| Service | Plan | Monthly cost |
|---------|------|-------------|
| Railway | Hobby ($5 credit) | ~$0-5/mo |
| Vercel | Hobby | Free |
| GitHub | Free | $0 |
| Groq | Free tier | $0 |

**Total: ~$0-5/month** for the full system at beta scale.

## Alternatives Considered

- **Vercel for everything**: Serverless timeout (10s) kills Socket Mode. Rejected.
- **Fly.io**: Better global distribution but more config complexity. Not needed for beta.
- **Single Railway service serving Next.js too**: Would work but Vercel is better for Next.js (CDN, incremental builds, preview deployments).
- **Self-hosted (DigitalOcean/EC2)**: Cheapest at scale but operational overhead not worth it at beta.
