# Communications

## Contents

- [Overview](#overview)
- [Email](#email)
- [Notifications](#notifications)
- [Webhooks](#webhooks)

---

## Overview

Communication channels:
- Email (transactional, marketing) - **partially implemented**
- In-app notifications (future)
- Webhooks (existing)
- Push notifications (future)

---

## Email

Located in `packages/email` (`@template/email`).

### Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Email clients | Done | Resend + Console |
| MJML validation | Done | Syntax checking |
| Component extraction | Done | `mapRefs()` |
| Variable interpolation | Done | sender/recipient/variable + conditionals |
| Cascade resolution | Done | Space → Org → default |
| Save pipeline | Done | Template + component persistence |
| Compose pipeline | Done | Fetch + expand components |
| Conditional rules | Done | `{{#if rule={...}}}` with json-rules |
| **Data hydration** | TODO | How to pipe in variables |
| **Sending jobs** | TODO | Queue-based async sending |
| **Preference management** | TODO | Unsubscribe, categories |

### Package Structure

```
packages/email/src/
├── client/               # Email providers
│   ├── resend.ts         # createResendClient(apiKey)
│   ├── console.ts        # createConsoleClient() - dev logging
│   └── types.ts          # SendEmailOptions, EmailClient
├── render/               # Template pipeline
│   ├── compose.ts        # composeTemplate/composeComponent
│   ├── expand.ts         # Recursive component expansion
│   ├── extractRefs.ts    # Component extraction (mapRefs)
│   ├── interpolate.ts    # Variable substitution + conditionals
│   ├── evaluateConditions.ts  # {{#if rule=...}} evaluation
│   ├── lookupTemplate.ts # Cascade lookup for templates/components
│   ├── lookupCascade.ts  # Cascade lookup for component refs
│   ├── save.ts           # Save pipeline coordinator
│   ├── errors.ts         # EmailRenderError
│   └── types.ts          # SaveContext, etc.
└── validations/          # MJML validation
    ├── validateMjml.ts
    └── MjmlValidationError.ts
```

---

### Email Clients

Two client implementations:

```typescript
import { createResendClient, createConsoleClient } from '@template/email/client';

// Production - sends via Resend API
const client = createResendClient(process.env.RESEND_API_KEY);

// Development - logs to console
const client = createConsoleClient();

// Send email
await client.send({
  to: 'user@example.com',
  from: 'noreply@example.com',
  subject: 'Welcome!',
  html: '<html>...</html>',
});
```

**SendEmailOptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string \| string[]` | Yes | Recipient(s) |
| `from` | `string` | Yes | Sender address |
| `subject` | `string` | Yes | Email subject |
| `html` | `string` | Yes | HTML content |
| `replyTo` | `string` | No | Reply-to address |
| `tags` | `string[]` | No | Tracking tags |
| `metadata` | `Record<string, string>` | No | Custom metadata |

---

### Database Models

#### EmailTemplate

MJML templates with ownership and componentRefs.

```prisma
model EmailTemplate {
  id               String
  name             String              // "OTP Verification"
  slug             String              // "otp"
  locale           String              // "en"
  category         CommunicationCategory
  subject          String              // "Your code: {{data.code}}"
  mjml             String              // Full MJML with component refs
  componentRefs    String[]            // Pre-computed slugs

  // Ownership (false polymorphism)
  ownerModel       EmailOwnerModel     // default|admin|Organization|Space
  organizationId   String?
  spaceId          String?
  inheritToSpaces  Boolean             // Allow Space to use Org template
}
```

#### EmailComponent

Reusable MJML blocks (headers, footers, buttons).

```prisma
model EmailComponent {
  id               String
  slug             String              // "default-header"
  mjml             String              // MJML fragment
  locale           String
  componentRefs    String[]            // Nested component slugs

  // Same ownership pattern as EmailTemplate
  ownerModel       EmailOwnerModel
  organizationId   String?
  spaceId          String?
  inheritToSpaces  Boolean
}
```

#### Enums

```prisma
enum CommunicationCategory {
  system        // OTP, password reset - cannot unsubscribe
  promotional   // Marketing - can unsubscribe
}

enum EmailOwnerModel {
  default       // Base templates - read: all, write: super admin
  admin         // Platform internal - super admin only
  Organization  // Tenant-branded
  Space         // Space-specific overrides
}
```

---

### Component System

#### Syntax

```mjml
{{#component:header}}
  <mj-section>
    {{#component:logo}}
      <mj-image src="logo.png" />
    {{/component:logo}}
  </mj-section>
{{/component:header}}
```

Pattern: `{{#component:slug}}...{{/component:slug}}`

#### Extraction (mapRefs)

```typescript
import { mapRefs } from '@template/email/render';

const result = mapRefs(mjmlString);
// result.map - { slug: [{ mjml, refs }] }
// result.mjml - Tagged output with :N indices
// result.refs - Top-level refs
```

Handles:
- Nested components (depth N)
- Variant deduplication (same MJML = same component)
- Variant indexing (`:0`, `:1` for different content)

---

### Variable Interpolation

Three prefixes for variable substitution:

| Prefix | Source | Example |
|--------|--------|---------|
| `sender` | Platform or org info | `{{sender.name}}` |
| `recipient` | Recipient user | `{{recipient.email}}` |
| `data` | Explicit from send call | `{{data.code}}` |

```typescript
import { interpolate } from '@template/email/render';

const html = interpolate(template, {
  sender: { name: 'Acme Corp' },
  recipient: { email: 'user@example.com', firstName: 'John' },
  data: { code: '123456' },
});
```

---

### Cascade Resolution

Templates and components resolve through ownership hierarchy:

| Context | Resolution Order |
|---------|------------------|
| Space | Space → Org (if `inheritToSpaces`) → default |
| Organization | Org → default |
| admin | admin only |
| default | default only |

This cascade happens automatically during compose - `composeTemplate` and `composeComponent` handle lookup based on the ownership context.

---

### Render Pipeline

The render pipeline has two phases:

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Compose (once per template)                       │
│  composeTemplate(slug, ctx) → { mjml, subject, category }   │
│     └── expand(mjml, componentRefs, ctx)                    │
│         └── lookupCascade → fetch components → replace refs │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Interpolate (per recipient)                       │
│  for (recipient of recipients) {                            │
│    interpolate(mjml, { sender, recipient, variable })       │
│      └── evaluateConditions ({{#if rule=...}})              │
│      └── substituteVariables ({{sender.*}}, etc.)           │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Phase 1** happens once - fetch template, expand all `{{#component:slug}}` refs.

**Phase 2** happens per recipient - evaluate conditionals and substitute variables.

#### Compose

```typescript
import { composeTemplate, composeComponent } from '@template/email/render';

// Compose a full template
const { mjml, subject, category } = await composeTemplate('welcome', {
  ownerModel: 'Organization',
  organizationId: org.id,
  locale: 'en',
});

// Compose a single component (for editor preview)
const { mjml } = await composeComponent('header', {
  ownerModel: 'default',
  locale: 'en',
});
```

#### Interpolate (per recipient)

```typescript
import { interpolate } from '@template/email/render';

const recipients = [user1, user2, user3];

for (const recipient of recipients) {
  const html = interpolate(mjml, {
    sender: { name: 'Acme Corp', logo: 'https://...' },
    recipient: { name: recipient.name, email: recipient.email, role: recipient.role },
    variable: { code: generateOtp() },
  });

  // Now render MJML to HTML and send
}
```

---

### Save Pipeline

Coordinates template + component persistence:

```typescript
import { saveEmailTemplate } from '@template/email/render';

const { template, components } = await saveEmailTemplate(db, {
  slug: 'welcome',
  name: 'Welcome Email',
  subject: 'Welcome, {{recipient.firstName}}!',
  mjml: '<mjml>...</mjml>',
  category: 'system',
  ownerModel: 'Organization',
  organizationId: 'org_123',
  locale: 'en',
});
```

Pipeline steps:
1. Validate MJML syntax
2. Extract component refs (`mapRefs`)
3. Lookup existing components via cascade
4. Resolve variants (match or create)
5. Save template + components in transaction

---

### MJML Validation

```typescript
import { validateMjml, MjmlValidationError } from '@template/email/validations';

try {
  validateMjml(mjmlString);
} catch (err) {
  if (err instanceof MjmlValidationError) {
    // err.issues: { line, message, tagName }[]
  }
}
```

---

### TODO: Send Pipeline

Not yet implemented. Planned flow:

```typescript
// Future API
await sendEmail({
  template: 'welcome',
  locale: 'en',
  to: user.email,
  context: {
    ownerModel: 'Organization',
    organizationId: org.id,
  },
  variables: {
    firstName: user.firstName,
  },
});
```

Will:
1. Lookup template via cascade
2. Resolve all component refs
3. Interpolate variables
4. Render MJML to HTML
5. Queue via BullMQ job

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

