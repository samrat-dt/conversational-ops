# Deployment Guide

> Two services to deploy: Railway (Slack bot + API) and Vercel (Web UI).
> Total setup time: ~20 minutes. Monthly cost: ~$0–5.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                  │
│                                                                   │
│  Beta Tester (browser)          Beta Tester (Slack)              │
│         │                               │                        │
│         ▼                               ▼                        │
│  ┌─────────────┐              ┌──────────────────┐              │
│  │   Vercel    │              │  Slack API       │              │
│  │  (web UI)   │              │  (WebSocket)     │              │
│  │  Next.js    │              └────────┬─────────┘              │
│  └──────┬──────┘                       │ Socket Mode             │
│         │  fetch /api/*                │                        │
│         ▼                             ▼                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                       Railway                               │ │
│  │   src/start.ts                                              │ │
│  │   ├── Express API  (:3001)                                  │ │
│  │   └── Slack Bolt   (Socket Mode)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                    │                    │                        │
│                    ▼                    ▼                        │
│             GitHub Issues           Groq API                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Deploy to Railway (backend + Slack bot)

### 1a. Create the project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo**
3. Select `samrat-dt/conversational-ops`
4. Railway auto-detects `railway.toml` and uses it

### 1b. Set environment variables

In Railway project → **Variables** tab, add:

```
GROQ_API_KEY_1          = gsk_...
GROQ_API_KEY_2          = gsk_...   (optional, for rotation)
GITHUB_TOKEN            = ghp_...
GITHUB_OWNER            = samrat-dt
GITHUB_REPO             = conversational-ops
SLACK_BOT_TOKEN         = xoxb-...
SLACK_APP_TOKEN         = xapp-...
CHANNEL_MAP             = sales-ops:sales,hiring-ops:hiring,cs-ops:customer-success,investor-ops:investor,partnerships-ops:partnership
WEB_ORIGIN              = https://your-app.vercel.app  (fill in after Vercel deploy)
```

### 1c. Get your Railway URL

After deploy, go to **Settings → Networking → Generate Domain**.
Copy the URL (e.g., `https://conversational-ops-production.up.railway.app`).

---

## Step 2 — Create the Slack App

### 2a. Create the app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Choose **From scratch**
3. Name: `Conversational Ops`
4. Pick your workspace

### 2b. Enable Socket Mode

1. Go to **Socket Mode** (left sidebar) → Enable
2. Click **Generate** under App-Level Tokens
3. Token name: `socket-token`
4. Scope: `connections:write`
5. Copy the token → this is your `SLACK_APP_TOKEN` (`xapp-...`)

### 2c. Add Bot Token Scopes

Go to **OAuth & Permissions** → **Bot Token Scopes**, add:

| Scope | Why |
|-------|-----|
| `channels:history` | Read messages in channels |
| `channels:read` | Resolve channel names from IDs |
| `reactions:write` | Add 👀 and ⏳ reactions |
| `chat:write` | Post replies |
| `commands` | Handle `/ops-reset` slash command |

### 2d. Enable Event Subscriptions

1. Go to **Event Subscriptions** → Enable
2. Under **Subscribe to bot events**, add: `message.channels`

### 2e. Install to workspace

Go to **OAuth & Permissions** → **Install to Workspace**
Copy the **Bot User OAuth Token** → this is your `SLACK_BOT_TOKEN` (`xoxb-...`)

### 2f. Add the bot to channels

In Slack, for each pipeline channel:
```
/invite @Conversational Ops
```

Do this for: `#sales-ops`, `#hiring-ops`, `#cs-ops`, `#investor-ops`, `#partnerships-ops`

---

## Step 3 — Deploy Web UI to Vercel

### 3a. Import the project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `samrat-dt/conversational-ops` from GitHub
3. **IMPORTANT:** Set **Root Directory** to `web`

### 3b. Set environment variables

In Vercel project settings → **Environment Variables**:

```
NEXT_PUBLIC_API_URL = https://your-app.up.railway.app
```
(Use the Railway URL from Step 1c)

### 3c. Deploy

Click **Deploy**. Vercel builds and deploys `web/` as a Next.js app.

Your web URL: `https://conversational-ops-web.vercel.app` (or similar)

### 3d. Update Railway CORS

Back in Railway → Variables, update:
```
WEB_ORIGIN = https://your-actual-vercel-url.vercel.app
```

Then redeploy Railway.

---

## Step 4 — Verify everything works

### Slack test
In `#sales-ops`:
```
Add deal "Test Corp" worth 25000 at Demo stage
```
Expect: bot replies in thread with issue link

```
Hey team, stand-up in 10 minutes
```
Expect: bot reacts with 👀, no reply

### Web test
Open your Vercel URL → select "Sales Pipeline" → type:
```
List all open deals
```
Expect: response appears after a few seconds

### API health check
```bash
curl https://your-app.up.railway.app/health
# → {"status":"ok","uptime":123}
```

---

## Local Development

```bash
# Clone and install
git clone https://github.com/samrat-dt/conversational-ops
cd conversational-ops
npm install

# Set up env
cp .env.example .env
# Edit .env with your real keys

# Run backend (Express API + Slack bot)
npm run dev:all

# In separate terminal — run web UI
cd web
npm install
cp .env.local.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
# → http://localhost:3000

# CLI (no server needed)
npm run dev -- --config templates/sales.yaml
```

---

## Sharing with Beta Testers

**Slack testers:** Invite them to the workspace + relevant channels. They just talk.

**Web testers:** Share the Vercel URL. No login required (for now).

**CLI testers:**
```bash
git clone https://github.com/samrat-dt/conversational-ops
cd conversational-ops
npm install
# Add .env with keys
npm run dev -- --config templates/sales.yaml
```

---

## Cost Summary

| Service | Plan | Estimated cost |
|---------|------|---------------|
| Railway | Hobby ($5 credit) | $0–5/month |
| Vercel | Hobby | Free |
| Groq | Free tier | Free (up to rate limits) |
| GitHub | Free | Free |
| **Total** | | **$0–5/month** |

---

## Updating / Redeploying

Both services auto-deploy on push to `main`:
- **Railway:** Watches `main` → builds → restarts
- **Vercel:** Watches `main` → builds `web/` → deploys

No manual deploys needed after initial setup.
