# INFRA-010: Cloudflare WAF, Init Script Integration, and Asset Serving

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Add Cloudflare as a front-layer for WAF rules, DDoS protection, and asset serving across all deployed surfaces (Vercel frontends, Railway API/worker). Integrate Cloudflare setup into the init script so new projects get a baseline security and CDN configuration out of the box.

## Objectives

- WAF rules protecting all public-facing endpoints (OWASP top 10 baseline)
- Cloudflare-proxied DNS for all domains (Vercel web/admin/superadmin, Railway API)
- Static asset serving and caching via Cloudflare CDN
- Init script automation for Cloudflare account/zone/DNS/WAF bootstrapping
- Config model in `project.config.ts` for Cloudflare state (zoneId, accountId, progress tracking)

---

## Tasks

### 1. Cloudflare Account and Zone Setup

- [ ] Add Cloudflare API client (`init/api/cloudflare.ts`) with VCR pattern
- [ ] Authenticate via Cloudflare API token (stored in Infisical)
- [ ] Create or select Cloudflare zone for project domain
- [ ] Configure DNS records pointing to Vercel and Railway origins
- [ ] Enable Cloudflare proxy (orange cloud) on all records

### 2. WAF Rules

- [ ] Enable OWASP Core Ruleset (managed rules)
- [ ] Add custom WAF rules for:
  - [ ] Rate limiting on auth endpoints (`/api/auth/*`)
  - [ ] Rate limiting on API endpoints (per-tenant or per-IP)
  - [ ] Bot management baseline
  - [ ] Geo-blocking (optional, configurable)
- [ ] Configure WAF exceptions for known-good traffic (webhooks, health checks)
- [ ] Add WAF rule for blocking common scanner paths (`/wp-admin`, `/xmlrpc.php`, etc.)

### 3. Asset Serving and Caching

- [ ] Configure Cloudflare cache rules for static assets (`/_next/static/*`, images, fonts)
- [ ] Set appropriate cache TTLs (immutable for hashed assets, short for HTML)
- [ ] Configure Cloudflare Page Rules or Cache Rules for Vercel preview vs production
- [ ] Ensure cache purge integration (on Vercel deploy, purge relevant paths)

### 4. Init Script Integration

- [ ] Add `cloudflare` section to `project.config.ts` type definition
- [ ] Create `init/tasks/cloudflareSetup.ts` with idempotent progress tracking
- [ ] Create `init/views/CloudflareSetupView.tsx` TUI view
- [ ] Add Cloudflare step to init orchestrator (after Vercel + Railway, since it needs their URLs)
- [ ] Store Cloudflare API token in Infisical
- [ ] Store zone ID, account ID in project config
- [ ] Add prerequisite check for Cloudflare CLI/API token

### 5. SSL and Security Headers

- [ ] Configure SSL mode (Full Strict) for all proxied domains
- [ ] Add security headers via Cloudflare Transform Rules:
  - [ ] `Strict-Transport-Security`
  - [ ] `X-Content-Type-Options`
  - [ ] `X-Frame-Options`
  - [ ] `Content-Security-Policy` (baseline)
  - [ ] `Permissions-Policy`
- [ ] Enable DNSSEC
- [ ] Configure minimum TLS version (1.2+)

---

## Open Questions

- Which Cloudflare plan tier to target? (Free tier covers basic WAF, Pro adds more managed rules)
- Should we use Cloudflare Workers for any edge logic, or keep it purely as a WAF/CDN proxy?
- How to handle Vercel's own CDN layer — Cloudflare in front of Vercel CDN means double-CDN. Need to configure Vercel to respect Cloudflare cache headers or disable Vercel CDN for proxied domains.
- Cloudflare API token scope — minimal permissions needed for init script automation
- Should WAF rules be per-environment (staging stricter than prod) or uniform?

---

## Implementation Notes

### Config Model

```typescript
cloudflare: {
  accountId: string;
  zoneId: string;
  domain: string;
  configProjectName: string;
  progress: {
    storeApiToken: boolean;
    selectAccount: boolean;
    createZone: boolean;
    configureDns: boolean;
    enableProxy: boolean;
    configureWaf: boolean;
    configureRateLimiting: boolean;
    configureCaching: boolean;
    configureSecurityHeaders: boolean;
    configureSsl: boolean;
  };
  error: string;
}
```

### DNS Records Needed

| Record | Type | Target | Proxied |
|--------|------|--------|---------|
| `app.{domain}` | CNAME | `cname.vercel-dns.com` | Yes |
| `admin.{domain}` | CNAME | `cname.vercel-dns.com` | Yes |
| `superadmin.{domain}` | CNAME | `cname.vercel-dns.com` | Yes |
| `api.{domain}` | CNAME | Railway public domain | Yes |

### Double-CDN Mitigation

Cloudflare in front of Vercel requires care:
- Set `Cache-Control: no-cache` at Cloudflare for HTML (let Vercel handle ISR)
- Cache only immutable static assets at Cloudflare layer
- Use Cloudflare `Bypass Cache` for API routes proxied through Vercel

---

## Definition of Done

- [ ] Init script creates Cloudflare zone and configures DNS for all services
- [ ] WAF rules active with OWASP baseline + custom rate limiting
- [ ] Static assets served through Cloudflare CDN with correct cache behavior
- [ ] Security headers applied to all responses
- [ ] SSL Full Strict mode enabled
- [ ] Progress tracking is idempotent (re-running init skips completed steps)
- [ ] VCR test fixtures captured for all Cloudflare API calls
- [ ] No console.log/error in Cloudflare init code (errors flow through TUI setError)

---

## Resources

- [Cloudflare API docs](https://developers.cloudflare.com/api/)
- [Cloudflare WAF Managed Rules](https://developers.cloudflare.com/waf/managed-rules/)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Vercel + Cloudflare proxy guide](https://vercel.com/docs/integrations/cloudflare)

---

## Related Tickets

- INFRA-001 (Init script)
- INFRA-003 (CI/CD)
- INFRA-005 (Platform baseline hosting + observability)

---

## Comments

_Created from discussion about adding Cloudflare as a WAF/CDN layer in front of all deployed services. The init script should handle full bootstrapping so new projects get security defaults automatically._
