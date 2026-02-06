# FEAT-011: Dates & Timezone Management

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement robust date/time handling with timezone support, recurring events, business hours, and calendar integrations.

## Key Components

### Timezone Support
- **User timezone**: Store per-user timezone preference
- **Org timezone**: Organization default timezone
- **Display**: Convert UTC → user's timezone
- **Storage**: Always store as UTC in database
- **Library**: `date-fns-tz` or `luxon`

### Recurring Events
- **RRULE**: RFC 5545 recurrence rules
- **Patterns**: Daily, weekly, monthly, custom
- **Exceptions**: Skip specific dates
- **End conditions**: Until date, count, or forever

### Business Hours
- **Operating hours**: Per organization/space
- **Holidays**: Calendar of non-working days
- **Availability**: Check if "open" at given time
- **Scheduling**: Booking within business hours

### Calendar Integration
- **iCal export**: Export events as .ics
- **Google Calendar**: Two-way sync
- **Outlook**: Integration
- **Webhooks**: Event reminders

## Use Cases

- User scheduling preferences
- Recurring billing dates
- Event scheduling
- Business hours display
- Automated reminders
- Report generation (timezone-aware)

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
