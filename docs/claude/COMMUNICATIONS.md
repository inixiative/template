# Communications

> Stub - to be expanded

## Contents

- [Overview](#overview)
- [Email](#email)
- [Notifications](#notifications)
- [Webhooks](#webhooks)

---

## Overview

Communication channels:
- Email (transactional, marketing)
- In-app notifications (future)
- Webhooks (existing)
- Push notifications (future)

---

## Email

TODO: Implement email system

### Planned Stack

| Component | Option | Notes |
|-----------|--------|-------|
| Provider | Resend / SendGrid | Transactional email |
| Templates | MJML | Responsive email markup |
| Queue | BullMQ | Async sending |

### Template Structure (Planned)

```
apps/api/src/
├── emails/
│   ├── templates/
│   │   ├── welcome.mjml
│   │   ├── passwordReset.mjml
│   │   └── invitation.mjml
│   └── send.ts
```

### Usage Pattern (Planned)

```typescript
import { sendEmail } from '#/emails/send';

await sendEmail({
  to: user.email,
  template: 'welcome',
  data: { name: user.firstName },
});
```

---

## Notifications

TODO: Implement notification system

### Planned: Novu

[Novu](https://novu.co/) for multi-channel notifications:
- Email
- In-app
- Push
- SMS

```typescript
// Future pattern
await notify(user.id, 'inquiry.received', {
  inquiryId: inquiry.id,
  senderName: sender.name,
});
```

---
## SMS
TODO: twilio?

---

## Webhooks

Existing webhook system. See [HOOKS.md](HOOKS.md) for webhook delivery.

```typescript
// Current: webhooks sent via sendWebhook job
db.onCommit(() => enqueue('sendWebhook', { ... }));
```

---
## Communication Preferences
TODO: Should be granular and manageable

