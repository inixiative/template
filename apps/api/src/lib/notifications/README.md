# Notifications - TODO

## Requirements
- Email (transactional, verification, alerts)
- Push notifications (web, mobile)
- In-app notifications (notification center)
- User preferences (opt-out, frequency)
- Template management (MJML for email)

## Options Considered

### 1. Novu Self-Hosted (Full Solution)
**Pros:** Complete multi-channel solution, user preferences, template editor, digest/batching
**Cons:** Requires MongoDB + Redis + multiple services

```bash
# Would need in docker-compose
- novu-api
- novu-worker
- novu-web (dashboard)
- mongodb
```

### 2. Knock (SaaS)
**Pros:** Similar to Novu but managed, generous free tier
**Cons:** Not self-hosted, vendor lock-in
https://knock.app

### 3. Ntfy (Lightweight Self-Hosted)
**Pros:** Single binary, pub/sub notifications, supports web push + mobile
**Cons:** No email, no templates, more DIY
https://ntfy.sh

### 4. Build Custom (Hybrid)
**Pros:** Full control, minimal dependencies
**Cons:** Time to build, easy to get wrong

```
Custom approach:
- MJML templates in codebase
- Email: Resend/SES/SMTP
- Push: Web Push API + Firebase for mobile
- In-app: Store in Postgres, serve via API/WebSocket
- Preferences: Simple user settings table
```

### 5. Apprise (Notification Aggregator)
**Pros:** Single API for 80+ notification services, self-hosted
**Cons:** Python-based, more of a relay than full solution
https://github.com/caronc/apprise

## Current Decision
Deferred. Using app events + WebSocket for real-time updates.
Email can be added standalone with MJML + transport when needed.

## When to Revisit
- When we need email verification flow
- When we need push notifications
- When we need notification preferences UI
