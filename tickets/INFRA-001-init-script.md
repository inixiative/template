# INFRA-001: Init Script & Environment Setup

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: High (Critical - validates platform before building features)
**Created**: 2026-02-06
**Updated**: 2026-02-14

---

## Overview

**Fully automated** infrastructure provisioning via service APIs. Provide credentials, run one command, get a deployed application.

**Zero manual steps** - Everything via API calls:
- Create databases (PlanetScale API)
- Provision compute (Render API)
- Deploy frontends (Vercel API)
- Configure secrets (Infisical API)
- Set up DNS (provider API if available)
- Configure GitHub Actions (GitHub API)
- Deploy and verify

**Philosophy:** Infrastructure as code. One command from fork to deployed staging environment.

## Objectives

- ✅ One-command setup from fork to deployed staging environment
- ✅ Service provisioning (PlanetScale, Render, Vercel, Infisical, Resend)
- ✅ Database branching (branch-per-PR workflow)
- ✅ Secret management (Infisical sync)
- ✅ DNS and domain setup
- ✅ Resumable progress for long-running setup
- ✅ Verify everything runs in production before building more features

---

## Final Architecture

**Database:** PlanetScale Postgres (branching, HA, $5/mo)
**Compute:** Render (API + Worker + Redis)
**Frontend:** Vercel (Web + Admin)
**Secrets:** Infisical (open source, team sync)
**Email:** Resend (required for auth)

**Environments:**
- **Local** - Docker Postgres + Redis (`.env.local`)
- **PR** - PlanetScale branch + Render preview (ephemeral)
- **Staging** - Main branch auto-deploys here
- **Production** - Manual promotion from staging

**Deployment Flow:**
```
Local → PR (branch) → Main (staging) → Promote (production)
```

---

## Tasks

### 0. API Credential Collection

**Goal:** Collect all required API keys upfront (no interruptions during provisioning)

**Interactive Prompts:**
```bash
bun run init

🚀 Template Project Initialization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will provision infrastructure via APIs.
You'll need API keys for the following services:

Required:
  • PlanetScale (Database)
  • Render (Compute)
  • Vercel (Frontend)
  • Infisical (Secrets)
  • Resend (Email)
  • GitHub (Already configured)

Optional:
  • Cloudflare (DNS - recommended)
  • Google OAuth
  • AWS S3 (File storage)
  • OpenAI / Anthropic (AI)

Ready? Let's go! ⚡
```

**Collect:**
- [ ] PlanetScale API token (required)
- [ ] Render API key (required)
- [ ] Vercel auth token (required)
- [ ] Infisical service token (required)
- [ ] Resend API key (required)
- [ ] GitHub token (check existing, or prompt)
- [ ] Project name (default: repo name)
- [ ] Primary domain (e.g., `myapp.com`)
- [ ] Cloudflare API token (optional - for DNS)
- [ ] OAuth credentials (optional)
- [ ] S3 credentials (optional)
- [ ] AI API keys (optional)

**Validation:**
- [ ] Test each API key (make simple API call)
- [ ] Fail fast if any required key is invalid
- [ ] Store in temporary secure state (`.init-state.json` - gitignored)

### 1. Prerequisites Check

- [ ] Detect OS and shell environment
- [ ] Verify required tools installed:
  - `bun` (package manager)
  - `git` (version control)
  - `docker` (local dev - optional)
- [ ] Verify git repository state (clean working tree)
- [ ] Check internet connectivity

### 2. Project Configuration

**Interactive Prompts:**
- [ ] Project name (default: repository name)
- [ ] Organization name
- [ ] Primary domain (e.g., `myapp.com`)
- [ ] Environment setup (dev only, or dev + staging + prod)

**Automated Actions:**
- [ ] Rename in `package.json` and all workspace packages
- [ ] Update import paths (`@template/*` → `@projectname/*`)
- [ ] Update README.md with project name
- [ ] Generate new `package-lock.json`/`bun.lockb`

### 3. Infisical Setup (Secrets Management)

**All via API - zero manual steps**

- [ ] Create Infisical project via API: `{project-name}`
- [ ] Create environments via API: `local`, `staging`, `production`
- [ ] Generate secure random secrets (crypto.randomBytes):
  - `JWT_SECRET` (256-bit)
  - `ENCRYPTION_KEY` (256-bit)
  - `WEBHOOK_SECRET` (256-bit)
  - `SESSION_SECRET` (256-bit)
  - `BETTER_AUTH_SECRET` (256-bit)
- [ ] Store generated secrets in Infisical via API
- [ ] Store service API keys (collected in step 0) in Infisical
- [ ] Create service tokens for CI/CD via API
- [ ] Generate `.env.local` from Infisical
- [ ] Set up Render integration via API (auto-sync)
- [ ] Set up Vercel integration via API (auto-sync)

### 4. PlanetScale Setup (Database)

**All via PlanetScale API:**
- [ ] Check if organization exists, create if needed (API)
- [ ] Create database via API: `{project-name}`
- [ ] Wait for database creation (poll status)
- [ ] Create `main` branch via API (production)
- [ ] Create `staging` branch via API
- [ ] Enable automatic backups via API
- [ ] Get connection strings from API (per branch)
- [ ] Store in Infisical via API:
  - `DATABASE_URL` (staging branch for staging env)
  - `DATABASE_URL` (main branch for production env)
- [ ] Generate initial migration (if needed)
- [ ] Run migration against staging branch: `prisma migrate deploy`

### 5. Render Setup (Compute)

**All via Render API:**
- [ ] Create Render project via API
- [ ] Create Redis instance via API
  - Store connection URL in Infisical
- [ ] Create API service via API:
  - Type: Web Service
  - Runtime: Bun
  - Build: `bun install && bun run build`
  - Start: `bun run start:api`
  - Env: Pull from Infisical (configure integration)
- [ ] Create Worker service via API:
  - Type: Background Worker
  - Runtime: Bun
  - Start: `bun run start:worker`
  - Env: Pull from Infisical
- [ ] Link GitHub repository via API
- [ ] Enable review apps via API (PR previews)
- [ ] Trigger initial deployment via API
- [ ] Poll deployment status, wait for success

### 6. Vercel Setup (Frontend)

**All via Vercel API:**
- [ ] Create team/org if needed via API
- [ ] Create project: `{project-name}-web` via API
  - Framework: React/Vite
  - Root: `apps/web`
  - Build: `bun run build`
  - Link GitHub repo
  - Enable preview deployments
  - Configure env vars from Infisical
- [ ] Create project: `{project-name}-admin` via API
  - Framework: React/Vite
  - Root: `apps/admin`
  - Build: `bun run build`
  - Link GitHub repo
- [ ] Create project: `{project-name}-superadmin` (optional) via API
  - Framework: React/Vite
  - Root: `apps/superadmin`
  - Build: `bun run build`
- [ ] Trigger initial deployments via API
- [ ] Poll deployment status, wait for success
- [ ] Get deployment URLs from API

### 7. Resend Setup (Email)

**Via Resend API:**
- [ ] Verify API key via API (make test call)
- [ ] Store in Infisical (already done in step 3)
- [ ] Check domain verification status via API
- [ ] If not verified:
  - Get DKIM/SPF records via API
  - Output DNS records to configure
  - Poll verification status (or continue, verify later)
- [ ] Send test email via API to verify
- [ ] Store test email result

### 8. Optional Integrations

**All automated where possible:**

**OAuth Providers:**
- [ ] If Google OAuth credentials provided:
  - Validate via API call
  - Store in Infisical
  - Add to auth provider config
- [ ] If GitHub OAuth credentials provided:
  - Validate via GitHub API
  - Store in Infisical
  - Add to auth provider config

**File Storage:**
- [ ] If S3 credentials provided:
  - Validate by listing buckets (AWS SDK)
  - Store in Infisical
  - Enable file upload features
- [ ] If Cloudinary credentials provided:
  - Validate via API
  - Store in Infisical

**AI Providers:**
- [ ] If OpenAI key provided:
  - Validate via API (list models)
  - Store in Infisical
- [ ] If Anthropic key provided:
  - Validate via API
  - Store in Infisical

**For declined integrations:**
- [ ] Log what was skipped
- [ ] Document integration points in `SETUP_COMPLETE.md`

### 9. DNS Configuration (Automated if Cloudflare)

**If Cloudflare credentials provided:**
- [ ] Create DNS records via Cloudflare API:
  - `myapp.com` → Vercel (Web)
  - `admin.myapp.com` → Vercel (Admin)
  - `api.myapp.com` → Render (API)
  - Email records (SPF, DKIM from Resend)
- [ ] Enable proxy (orange cloud) for web domains
- [ ] Verify SSL certificates auto-provision

**If no DNS provider:**
- [ ] Output required DNS records to configure manually
- [ ] Save to `DNS_RECORDS.md`
- [ ] Continue (DNS can be configured later)

**CORS Configuration:**
- [ ] Generate CORS whitelist from domains via script
- [ ] Store `CORS_ORIGIN` in Infisical
- [ ] Auto-update on domain changes

### 10. Database Seeding

**Automated seeding:**
- [ ] Wait for Render API deployment to be live
- [ ] Run migration via Render API exec:
  - `bun run db:migrate:deploy`
- [ ] Run seed via Render API exec:
  - `bun run db:seed`
- [ ] Generate superadmin credentials (random password)
- [ ] Store superadmin email/password securely
- [ ] Output to console (masked, copy to clipboard)
- [ ] Save to `SUPERADMIN_CREDENTIALS.txt` (gitignored)

### 7. Progress Tracking

**State File: `.init-progress.json`**
```json
{
  "version": "1.0",
  "projectName": "my-saas",
  "startedAt": "2026-02-06T10:00:00Z",
  "lastStep": "dopplerSetup",
  "completed": [
    "prerequisites",
    "project-config",
    "dopplerSetup"
  ],
  "data": {
    "projectName": "my-saas",
    "domain": "myapp.com",
    "services": {
      "render": { "id": "srv_xxx", "url": "https://api.myapp.com" },
      "sentry": { "projects": ["proj_xxx"] }
    }
  }
}
```

**Commands:**
- [ ] `bun run init` - Start or resume setup
- [ ] `bun run init:restart` - Clear progress and start over
- [ ] `bun run init:status` - Show current progress

### 8. Validation & Testing

**Local:**
- [ ] Run test suite: `bun test`
- [ ] Start dev server: `bun run dev`
- [ ] Open browser to `http://localhost:3000`
- [ ] Verify login works
- [ ] Verify database connection (Docker Postgres)
- [ ] Verify Redis connection (Docker Redis)

**Staging (Production Validation):**
- [ ] Deploy to Render staging
- [ ] Open staging URL
- [ ] Verify login works (OAuth if configured)
- [ ] Verify database connection (PlanetScale)
- [ ] Verify Redis connection (Render Redis)
- [ ] Verify WebSocket connection
- [ ] Verify background jobs work
- [ ] Verify email sending works (Resend)
- [ ] Run smoke tests against staging
- [ ] Check logs for errors

### 11. GitHub Actions Setup

**Automated via GitHub API:**
- [ ] Create workflow files from templates
- [ ] Commit to `.github/workflows/` via GitHub API:
  - `pr-preview.yml` - PlanetScale branch + Render preview
  - `staging-deploy.yml` - Auto-deploy main to staging
  - `production-deploy.yml` - Manual production deploy
- [ ] Create GitHub secrets via API:
  - `PLANETSCALE_TOKEN`
  - `RENDER_API_KEY`
  - `VERCEL_TOKEN`
  - `INFISICAL_TOKEN`
- [ ] Create GitHub environment via API:
  - `staging` (auto-deploy)
  - `production` (manual approval required)
- [ ] Trigger initial staging deployment via API

### 12. Final Verification

**Automated health checks:**
- [ ] Check Render API health endpoint (`/health`)
- [ ] Check Vercel deployment URLs (200 OK)
- [ ] Verify PlanetScale connection (query test)
- [ ] Verify Redis connection (ping)
- [ ] Verify Infisical sync working
- [ ] Test login flow (headless browser)
- [ ] Test email sending
- [ ] Verify WebSocket connection
- [ ] Run smoke test suite

### 13. Documentation Generation

**Automated:**
- [ ] Generate `SETUP_COMPLETE.md` with:
  - All service URLs (from APIs)
  - Staging environment URL
  - Superadmin credentials (secure link)
  - Next steps checklist
  - Branch-per-PR workflow
  - Troubleshooting guide
  - Integration points for optional services
- [ ] Update `README.md` with project name
- [ ] Generate `DNS_RECORDS.md` if DNS not automated
- [ ] Save init config to `init.config.json`
- [ ] Git commit via API: "chore: initialize project from template"
- [ ] Output success summary with URLs

---

## User Experience

**From fork to deployed in ~10 minutes:**

```bash
# Clone template
git clone https://github.com/yourorg/template my-saas
cd my-saas

# Run init
bun run init

# Collect credentials (2-3 minutes)
? PlanetScale API token: ••••••••
? Render API key: ••••••••
? Vercel auth token: ••••••••
? Infisical service token: ••••••••
? Resend API key: ••••••••
? Project name: my-saas
? Primary domain: mysaas.com
? Configure Cloudflare DNS? (Y/n) y
? Cloudflare API token: ••••••••
? Configure Google OAuth? (y/N) n
? Configure file storage? (y/N) n

✓ All credentials validated

# Automated provisioning (5-7 minutes)
⠋ Creating Infisical project...                ✓ Done
⠋ Generating secrets...                        ✓ Done
⠋ Creating PlanetScale database...             ✓ Done (my-saas)
⠋ Creating database branches...                ✓ Done (main, staging)
⠋ Creating Render services...                  ✓ Done (API, Worker, Redis)
⠋ Creating Vercel projects...                  ✓ Done (Web, Admin)
⠋ Configuring DNS (Cloudflare)...              ✓ Done
⠋ Running database migrations...               ✓ Done
⠋ Seeding database...                          ✓ Done
⠋ Creating GitHub Actions workflows...         ✓ Done
⠋ Deploying to staging...                      ⠋ (30s)
⠋ Running health checks...                     ✓ All systems operational

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Setup complete! Your infrastructure is ready.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Staging URL: https://my-saas-staging.onrender.com
🌐 Web App:     https://staging.mysaas.com
🌐 Admin:       https://admin-staging.mysaas.com

🔐 Superadmin Credentials:
   Email:    admin@mysaas.com
   Password: ••••••••  (copied to clipboard)

📚 Next Steps:
   • Login to staging environment
   • Invite team members
   • Configure production environment
   • Review SETUP_COMPLETE.md for details

💾 Configuration saved to:
   • init.config.json
   • SETUP_COMPLETE.md
   • SUPERADMIN_CREDENTIALS.txt (gitignored)
```

**Zero manual steps. Everything automated.**

---

## Implementation Plan

### Script Structure

```bash
scripts/init/
├── index.ts                     # Main orchestrator
├── cli.ts                       # CLI interface, prompts
├── state.ts                     # Progress state management
├── steps/
│   ├── 00-collect-credentials.ts    # Collect all API keys upfront
│   ├── 01-prerequisites.ts          # Verify environment
│   ├── 02-project-config.ts         # Rename, configure
│   ├── 03-infisical.ts              # Create project, secrets via API
│   ├── 04-planetscale.ts            # Create DB, branches via API
│   ├── 05-render.ts                 # Create services via API
│   ├── 06-vercel.ts                 # Create projects via API
│   ├── 07-resend.ts                 # Verify email via API
│   ├── 08-integrations.ts           # Optional (OAuth, S3, AI) via APIs
│   ├── 09-dns.ts                    # Cloudflare API (or output records)
│   ├── 10-seed.ts                   # Seed DB via Render exec API
│   ├── 11-github-actions.ts         # Create workflows via GitHub API
│   ├── 12-verify.ts                 # Health checks, smoke tests
│   └── 13-docs.ts                   # Generate documentation
├── api/
│   ├── planetscale.ts               # PlanetScale API client
│   ├── render.ts                    # Render API client
│   ├── vercel.ts                    # Vercel API client
│   ├── infisical.ts                 # Infisical API client
│   ├── resend.ts                    # Resend API client
│   ├── cloudflare.ts                # Cloudflare API client
│   └── github.ts                    # GitHub API client (Octokit)
├── utils/
│   ├── prompt.ts                    # Interactive prompts
│   ├── progress.ts                  # State persistence (.init-state.json)
│   ├── secrets.ts                   # Crypto utilities
│   ├── spinner.ts                   # CLI UI (ora)
│   ├── logger.ts                    # Structured logging
│   └── poll.ts                      # Poll API status (deployments, etc.)
└── templates/
    ├── github-workflows/
    │   ├── pr-preview.yml
    │   ├── staging-deploy.yml
    │   └── production-deploy.yml
    ├── SETUP_COMPLETE.md.hbs
    └── DNS_RECORDS.md.hbs
```

### Key Technologies

- **API Clients**: Native fetch / `ofetch`
- **Prompts**: `@inquirer/prompts` (typed, modern)
- **CLI UI**: `ora` (spinners), `chalk` (colors), `boxen` (boxes)
- **Templates**: `handlebars` (docs generation)
- **Crypto**: `node:crypto` (secret generation)
- **GitHub**: `@octokit/rest` (GitHub API)
- **State**: JSON file (`.init-state.json`, gitignored)

### API Libraries

```json
{
  "dependencies": {
    "@inquirer/prompts": "^5.0.0",
    "@octokit/rest": "^20.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.3.0",
    "boxen": "^7.1.0",
    "handlebars": "^4.7.8",
    "ofetch": "^1.3.3"
  }
}
```

---

## Architecture Decisions

### ✅ Database: PlanetScale Postgres
- Real Postgres with branching ($5/mo)
- HA: 3 AZ, auto-failover
- Query insights built-in
- Branch-per-PR workflow
- Migration path documented

### ✅ Secrets: Infisical (not Doppler)
- Open source (can self-host)
- Free for teams
- Git-like workflow
- Render/Vercel integrations

### ✅ Compute: Render (API + Worker + Redis)
- Simple (all backend in one place)
- Good DX
- Review apps built-in

### ✅ Frontend: Vercel (Web + Admin)
- Edge deployment
- Preview deployments
- Best DX for frontends

### ✅ Environments: 3 (not 5)
- Local (Docker)
- Staging (persistent, main branch)
- Production (manual promotion)

---

## Definition of Done

- [ ] `bun run init` completes successfully on fresh fork
- [ ] PlanetScale database provisioned with branches
- [ ] Render services deployed (API + Worker + Redis)
- [ ] Vercel projects deployed (Web + Admin)
- [ ] Infisical syncing secrets automatically
- [ ] Resend sending emails successfully
- [ ] Staging environment fully working (can login, use features)
- [ ] PR preview deployments working (branch-per-PR)
- [ ] Database migrations run successfully
- [ ] Background jobs processing
- [ ] WebSockets connecting
- [ ] All tests passing in staging
- [ ] Superadmin user created (credentials output)
- [ ] Progress can be resumed after interruption
- [ ] Documentation generated (`SETUP_COMPLETE.md`)
- [ ] CI/CD workflows configured
- [ ] **Codebase validated in production before building more features**

---

## Resources

- Render API: https://api-docs.render.com/
- Doppler CLI: https://docs.doppler.com/docs/cli
- Sentry API: https://docs.sentry.io/api/
- Similar: `create-t3-app`, `create-next-app`
- Reference: TODO.md line 142

---

## Related Tickets

- **Blocked by**: None
- **Blocks**: RENDER-001 (Production Deploy Config)

---

## Comments

_Add implementation notes, blockers, or updates here as work progresses._
