# Roadmap — Multi-tenant Operator Model

**Status:** Planned (not yet implemented)
**Prerequisite:** Beta testing of single-tenant version passes

---

## The Model

You (samrat-dt) are the platform operator. Clients are users.
Clients never touch GitHub, never see repos, never manage infra.

```
YOU (operator)
├── Own all GitHub repos (private, one per client)
├── Own the Railway deployment (one instance, multi-tenant)
├── Own the Slack workspace (invite clients to their channels)
├── Own the Groq keys
└── Run onboard.ts when a new client joins (~30 seconds)

CLIENT (user)
├── Slack: invited to #acme-sales-ops, #acme-hiring, etc.
│   └── Just talks. GitHub is invisible.
├── Web: given URL yourapp.vercel.app/acme/sales
│   └── Just chats. GitHub is invisible.
└── CLI: given a .env.acme bundle + npx command
    └── Just runs commands. GitHub is invisible.
```

---

## Directory Structure (post-migration)

```
conversational-ops/
├── clients/                        ← NEW: per-client configs (gitignored or private)
│   ├── acme/
│   │   ├── meta.yaml               ← client name, contact, github repo
│   │   └── pipelines/
│   │       ├── sales.yaml          ← points to samrat-dt/acme-ops (private repo)
│   │       └── hiring.yaml
│   └── betacorp/
│       ├── meta.yaml
│       └── pipelines/
│           └── sales.yaml
│
├── scripts/                        ← NEW: operator tooling
│   ├── onboard.ts                  ← provision new client
│   └── bundle-cli.ts               ← generate CLI bundle for a client
│
└── src/
    ├── server/index.ts             ← UPDATE: multi-tenant routing
    ├── slack/channel-map.ts        ← UPDATE: #acme-sales-ops → clients/acme/pipelines/sales.yaml
    └── web/app/[client]/[pipeline] ← UPDATE: URL structure
```

---

## Implementation Plan

### 1. `scripts/onboard.ts`
Provisions a new client end-to-end:
```bash
npx tsx scripts/onboard.ts --client acme --templates sales,hiring
```
Steps:
- Creates private GitHub repo `samrat-dt/acme-ops`
- Creates `clients/acme/meta.yaml`
- Copies and customizes template YAMLs into `clients/acme/pipelines/`
- Runs `ensureAllStageLabels()` on the new repo
- Prints Slack invite instructions
- Outputs `.env.acme` file for CLI distribution

### 2. `clients/<name>/meta.yaml` schema
```yaml
name: Acme Corp
contact: jane@acme.com
github:
  owner: samrat-dt
  repo: acme-ops          # private repo, only your token can access
slack:
  channels:
    - name: acme-sales-ops
      pipeline: sales
    - name: acme-hiring-ops
      pipeline: hiring
created: 2026-03-14
```

### 3. Server — multi-tenant routing
API routes gain a `clientId` prefix:
```
GET  /api/:clientId/configs
GET  /api/:clientId/pipeline/:config/items
POST /api/:clientId/chat
POST /api/:clientId/reset
```
Config loaded from `clients/:clientId/pipelines/:config.yaml`

### 4. Slack — per-client channel naming
Channel convention: `#<clientid>-<pipeline>-ops`
```
#acme-sales-ops       → clients/acme/pipelines/sales.yaml
#acme-hiring-ops      → clients/acme/pipelines/hiring.yaml
#betacorp-sales-ops   → clients/betacorp/pipelines/sales.yaml
```

### 5. Web — per-client URL
```
/acme/sales           → clients/acme/pipelines/sales.yaml
/acme/hiring          → clients/acme/pipelines/hiring.yaml
/betacorp/sales       → clients/betacorp/pipelines/sales.yaml
```

### 6. `scripts/bundle-cli.ts`
Generates a ready-to-use CLI bundle for a client:
```bash
npx tsx scripts/bundle-cli.ts --client acme
# Outputs: dist/cli-bundles/acme.zip
# Contains: .env (with your token pointing to acme-ops), their pipeline YAMLs, usage instructions
```
Client unzips, runs `npx tsx src/cli.ts --config sales.yaml`. Done.

---

## Security Model

| What | Who has access |
|------|---------------|
| GitHub repos (private) | Only you via GITHUB_TOKEN on Railway |
| Pipeline data (issues) | Only you (GitHub) + the agent (via token) |
| Slack channels | Client users (invited by you) |
| Web UI | Client users (given the URL) |
| CLI | Client users (given the bundle) |
| Railway/Vercel/Groq | Only you |

Clients interact through the interface layer only. The data layer (GitHub) is completely opaque to them.

---

## Migration from single-tenant

When ready to migrate from the current beta setup:
1. Run `onboard.ts` for each existing beta tester
2. Update Railway env: remove `GITHUB_REPO` (no longer a single global repo)
3. Update Slack channel names to include client prefix
4. Update web URL structure
5. Existing issues can be migrated with a script (update labels, move to new repo)

---

## Trigger for implementation

Start building when:
- [ ] At least 2 beta testers are actively using the tool
- [ ] The core tool UX is validated (creating issues, running reports, Slack flow)
- [ ] You're ready to onboard a paying or serious beta customer with real data
