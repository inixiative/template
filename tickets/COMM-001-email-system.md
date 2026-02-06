# COMM-001: Email System (Complete)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Complete the email system stub with transactional email templates, delivery tracking, and rule-based automation. Requires rules builder for conditional email logic.

## Key Components

- **Templates**: React Email for beautiful emails
  - Welcome email
  - Invitation email
  - Password reset
  - Receipts/invoices
  - Notifications
  - Digest emails
- **Providers**: Support Resend, SendGrid, AWS SES
- **Delivery tracking**: Open rates, click rates, bounces
- **Rules engine**: Conditional email sending (requires INFRA-002)
- **Preferences**: User opt-in/opt-out per email type
- **Queue**: BullMQ integration for reliable delivery

## Reference

- TODO.md: Line 99 (I18n package)
- Current: `packages/email/` (stub exists)
- User note: "Blocked by rules builder"

## Related Tickets

- **Blocked by**: INFRA-002 (Rules builder)
- **Blocks**: FEAT-001 (Inquiry system - needs invite emails)

---

_Stub ticket - expand when prioritized_
