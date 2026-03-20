# COMM-002: Email Validation Service

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-20
**Updated**: 2026-03-20

---

## Overview

Integrate an email validation/verification API to validate email addresses at point of capture (signup, forms, invitations) and optionally for bulk list hygiene. This reduces bounces, protects sender reputation, and improves deliverability once the email system (COMM-001) is live.

## Objectives

- ✅ Real-time email validation on signup and form submission
- ✅ Bulk list validation capability for existing contacts
- ✅ Reduce hard bounces and protect sender reputation
- ✅ Detect disposable/temporary email addresses
- ✅ Keep costs low for early-stage usage

---

## Research: Service Comparison (March 2026)

### Recommended: Bouncer

**Why**: Best balance of price, accuracy, and developer experience. ISO-27001 certified, EU-based, strong GDPR compliance. Uses multiple validation steps (syntax, DNS, MX, SMTP, disposable detection, catch-all detection). Cheapest service with proven accuracy in independent benchmarks.

| Service | Cost/Email | Free Tier | API Quality | Accuracy | Notes |
|---|---|---|---|---|---|
| **Bouncer** | $0.002–$0.007 | — | Good REST API | High (multi-step) | **Recommended**. Best price-to-accuracy. ISO-27001, GDPR. |
| **Emailable** | ~$0.003–$0.005 | 250 free | Clean REST API | Good | Fast verification, generous free tier for testing. |
| **MillionVerifier** | ~$0.0002 (at 1M) | — | Basic | Lower | Cheapest raw price but higher false-positive rate. Not recommended for transactional. |
| **EmailListVerify** | ~$0.004 | — | Decent | Good | Budget-friendly, lacks advanced catch-all handling. |
| **Clearout** | Low at scale | Limited | Good, real-time focus | Good | Native real-time validation, good for forms. |
| **NeverBounce** | ~$0.009 | — | Good | Good | Fastest bulk processing. Credits expire after 12 months. |
| **ZeroBounce** | ~$0.01 | 100/mo free | Enterprise-grade | High | Premium pricing, deep data enrichment, 45+ integrations. Overkill for early stage. |
| **Kickbox** | ~$0.01 | — | Good | High | Reliable but premium tier pricing. |

### Recommendation Tiers

1. **Start with**: **Bouncer** — best accuracy per dollar, strong API, privacy-first
2. **Runner-up**: **Emailable** — if we want a free tier for early development/testing
3. **Budget fallback**: **Clearout** — if volume gets very high and we need cheaper at-scale pricing
4. **Avoid for now**: MillionVerifier (accuracy concerns), ZeroBounce/Kickbox (overpriced for our stage)

### Cost Projection

| Monthly Emails | Bouncer Cost | ZeroBounce Cost | Savings |
|---|---|---|---|
| 1,000 | ~$5 | ~$10 | 50% |
| 10,000 | ~$30 | ~$100 | 70% |
| 100,000 | ~$200 | ~$1,000 | 80% |

---

## Tasks

### 1. Design & Architecture

- [ ] Define `EmailValidator` interface in `packages/email` (mirroring `EmailClient` pattern)
- [ ] Support provider swapping (Bouncer, Emailable, etc.) via adapter pattern
- [ ] Decide on caching strategy (cache validation results to avoid re-verifying same emails)

### 2. Real-Time Validation (Point of Capture)

- [ ] Add validation API endpoint (e.g., `POST /api/email/validate`)
- [ ] Integrate into signup/invitation forms (frontend debounced check)
- [ ] Block or warn on disposable/invalid emails at form level
- [ ] Rate-limit validation endpoint to prevent abuse

### 3. Bulk Validation

- [ ] BullMQ job for bulk list validation
- [ ] Track validation status per contact (valid, invalid, risky, unknown)
- [ ] Store validation results and timestamp in DB

### 4. Provider Integration

- [ ] Implement Bouncer adapter (primary)
- [ ] Implement fallback/secondary adapter (Emailable or Clearout)
- [ ] Add provider API key to encrypted secrets management (FEAT-013)
- [ ] Console/mock adapter for development (like existing `ConsoleEmailClient`)

### 5. Monitoring & Observability

- [ ] Track validation hit/miss rates
- [ ] Alert on high invalid-email rates (potential abuse signal)
- [ ] Dashboard metrics for email quality

---

## Open Questions

- Should we validate on every form submission or only on account creation / first contact?
- Do we want to re-validate existing emails periodically (email addresses go stale)?
- Should invalid emails be hard-blocked or soft-warned (UX decision)?
- Cache TTL for validation results — 30 days? 90 days?

---

## Implementation Notes

### Adapter Architecture (Bring Your Own Provider)

The template ships adapter code but **no API key** — deployers register with their chosen provider and supply their own key, same pattern as `ResendEmailClient`:

```
EmailValidator (interface)
├── BouncerValidator      ← default/recommended adapter
├── EmailableValidator    ← alternative adapter
├── ClearoutValidator     ← alternative adapter
└── ConsoleValidator      ← dev/test mock (always returns valid)
```

- Provider selection via env var (e.g., `EMAIL_VALIDATOR_PROVIDER=bouncer`)
- API key via encrypted secrets (e.g., `EMAIL_VALIDATOR_API_KEY`)
- Each deployer/tenant registers their own account with the provider
- Template ships with Bouncer as the default adapter; others can be added by the community or per-project

### General Notes

- Follow the existing `EmailClient` interface pattern in `packages/email/src/client/`
- Current email validation is Zod `.email()` only (syntax check) — this adds mailbox-level verification
- Provider API key should go through the encrypted secrets system (FEAT-013)
- Consider starting with real-time only; bulk can come later as a phase 2

---

## Definition of Done

- [ ] `EmailValidator` interface defined and documented
- [ ] At least one provider adapter implemented (Bouncer)
- [ ] Mock/console adapter for development
- [ ] Real-time validation endpoint with rate limiting
- [ ] Frontend integration on key forms
- [ ] Validation results stored in DB
- [ ] Tests passing for adapter and endpoint
- [ ] `bun run check` passing

---

## Resources

- [Bouncer API Docs](https://bouncer.io)
- [Emailable API Docs](https://emailable.com)
- [2026 Email Verification Comparison (Hunter.io)](https://hunter.io/email-verification-guide/best-email-verifiers/)
- [2026 Email Verification Comparison (ClearBounce)](https://clearbounce.net/blog/best-email-verification-tools)
- [ZeroBounce Alternatives (Mailmend)](https://mailmend.io/blogs/best-zerobounce-alternatives)

---

## Related Tickets

- **Depends on**: COMM-001 (Email system — needs to be set up first)
- **Related**: FEAT-013 (Encryption — for API key storage)
- **Related**: FEAT-001 (Inquiry system — benefits from validated emails)
- **Related**: FEAT-012 (Notifications — validated emails improve delivery)

---

## Comments

_2026-03-20: Ticket created from research. Bouncer recommended as primary provider based on price-to-accuracy ratio. Will revisit provider choice when COMM-001 is closer to completion._
