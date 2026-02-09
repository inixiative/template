# INFRA-001: Init Script & Environment Setup

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Interactive setup wizard that transforms a fresh fork into a production-ready environment. Handles account creation, service provisioning, secret management, DNS configuration, and deployment setup with resume/restart capability.

## Objectives

- ✅ One-command setup from fork to deployed
- ✅ Service account provisioning (Render, Doppler, Sentry, etc.)
- ✅ Environment configuration with secure secrets
- ✅ DNS and domain setup
- ✅ Resumable progress for long-running setup

---

## Tasks

### 1. Prerequisites Check

- [ ] Detect OS and shell environment
- [ ] Verify required tools installed:
  - `bun` (package manager)
  - `docker` (local services)
  - `git` (version control)
  - `gh` (GitHub CLI)
  - Optional: `doppler` CLI
- [ ] Check Docker daemon running
- [ ] Verify git repository state (clean working tree)

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

### 3. Doppler Setup

**Account & Project:**
- [ ] Check if Doppler CLI installed
- [ ] Authenticate with Doppler (if needed)
- [ ] Create Doppler project: `{project-name}`
- [ ] Create environments: `dev`, `staging`, `prod`
- [ ] Set up service tokens for CI/CD

**Secret Generation:**
- [ ] Generate secure random secrets:
  - `JWT_SECRET` (256-bit)
  - `ENCRYPTION_KEY` (256-bit)
  - `WEBHOOK_SECRET` (256-bit)
  - `SESSION_SECRET` (256-bit)
- [ ] Prompt for service API keys (see section 4)
- [ ] Write to Doppler environments
- [ ] Create local `.env.local` from template
- [ ] Add `.env.local` to `.gitignore` (verify)

### 4. Service Account Setup

**Render (Hosting):**
- [ ] Prompt for Render API key
- [ ] Create Render project
- [ ] Provision services:
  - API (Bun web service)
  - Worker (background jobs)
  - Postgres database
  - Redis instance
- [ ] Generate `render.yaml` with service definitions
- [ ] Link GitHub repository for auto-deploy
- [ ] Configure environment groups in Render
- [ ] Set up review apps for PR branches

**Sentry (Error Tracking):**
- [ ] Prompt for Sentry auth token
- [ ] Create Sentry organization (or use existing)
- [ ] Create projects:
  - `{project}-api`
  - `{project}-web`
  - `{project}-admin`
  - `{project}-superadmin`
- [ ] Generate DSN keys for each project
- [ ] Store DSNs in Doppler

**Email Provider:**
- [ ] Choose provider (Resend, SendGrid, AWS SES)
- [ ] Prompt for API key
- [ ] Verify sending domain (instructions)
- [ ] Configure DKIM/SPF records (DNS)
- [ ] Store credentials in Doppler

**Stripe (Optional - Payments):**
- [ ] Prompt to set up Stripe (y/n)
- [ ] If yes:
  - Prompt for test keys
  - Prompt for live keys
  - Configure webhook endpoints
  - Store in Doppler

**OAuth Providers (Optional):**
- [ ] Prompt to configure OAuth (y/n)
- [ ] If yes, for each provider (Google, GitHub, etc.):
  - Provide setup instructions
  - Prompt for client ID/secret
  - Configure redirect URLs
  - Store in Doppler

### 5. DNS Configuration

**Domain Setup:**
- [ ] Prompt for DNS provider (Cloudflare, Route53, etc.)
- [ ] Provide DNS record instructions:
  - Main domain → Render service
  - `api.domain.com` → API service
  - `admin.domain.com` → Admin app
  - Email verification records (SPF, DKIM, DMARC)
- [ ] Verify DNS propagation
- [ ] Configure SSL certificates (Render auto-SSL)

**CORS Configuration:**
- [ ] Generate CORS whitelist from domains
- [ ] Update `CORS_ORIGIN` in environment
- [ ] Document white-label CORS hooks

### 6. Database Setup

- [ ] Run Prisma migrations: `bun run db:migrate:deploy`
- [ ] Run seed script: `bun run db:seed`
- [ ] Verify database connection
- [ ] Create initial superadmin user
- [ ] Output superadmin credentials (secure display)

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

- [ ] Run test suite: `bun test`
- [ ] Start dev server: `bun run dev`
- [ ] Open browser to `http://localhost:3000`
- [ ] Verify login works
- [ ] Verify database connection
- [ ] Verify Redis connection
- [ ] Check Sentry error reporting (trigger test error)

### 9. Documentation Generation

- [ ] Create `SETUP_COMPLETE.md` with:
  - Service URLs and credentials
  - Next steps (invite team, configure features)
  - Deployment commands
  - Troubleshooting guide
- [ ] Update `README.md` with project-specific info
- [ ] Git commit all changes: "chore: initialize project from template"

---

## Implementation Plan

### Script Structure

```bash
scripts/
├── init/
│   ├── index.ts              # Main orchestrator
│   ├── steps/
│   │   ├── 01-prerequisites.ts
│   │   ├── 02-project-config.ts
│   │   ├── 03-doppler.ts
│   │   ├── 04-services.ts
│   │   ├── 05-dns.ts
│   │   ├── 06-database.ts
│   │   ├── 07-validation.ts
│   │   └── 08-docs.ts
│   ├── utils/
│   │   ├── prompt.ts         # Interactive prompts
│   │   ├── progress.ts       # State management
│   │   ├── secrets.ts        # Crypto utilities
│   │   └── spinner.ts        # CLI UI
│   └── templates/
│       ├── render.yaml.hbs
│       ├── SETUP_COMPLETE.md.hbs
│       └── .env.local.hbs
```

### Key Technologies

- **Prompts**: `@inquirer/prompts` (modern, typed)
- **CLI UI**: `ora` (spinners), `chalk` (colors), `boxen` (boxes)
- **HTTP**: `ofetch` (API calls to services)
- **Templates**: `handlebars` (config generation)
- **Crypto**: Node `crypto` module (secret generation)

---

## Open Questions

### 1. Doppler vs .env Files
Should we require Doppler, or support .env fallback?
- **Pro Doppler**: Centralized secrets, team sync, audit logs
- **Pro .env**: Simpler, no external dependency
- **Recommendation**: Support both, prefer Doppler

### 2. Render Alternatives
Should we support other hosting platforms?
- Vercel (frontend)
- Fly.io
- Railway
- Heroku
- **Decision needed**: Start Render-only, add flags later?

### 3. Monorepo Renaming
How deep should the rename go?
- Package names in `package.json`
- Import path aliases
- Docker service names
- Database name
- **Recommendation**: Full rename, provide undo script

---

## Definition of Done

- [ ] `bun run init` completes successfully on fresh fork
- [ ] All services provisioned and configured
- [ ] Database seeded with superadmin user
- [ ] Dev environment starts without errors
- [ ] Production deployment succeeds
- [ ] Sentry receives test events
- [ ] Email sending works (test email sent)
- [ ] DNS records documented and verified
- [ ] Progress can be resumed after interruption
- [ ] Documentation generated (`SETUP_COMPLETE.md`)
- [ ] Init script documented in `docs/claude/SCRIPTS.md`

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
