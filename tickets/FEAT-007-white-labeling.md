# FEAT-007: White Labeling

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Enable white-labeling capabilities with custom domains, branding, and dynamic CORS configuration. Includes DNS management hooks and per-space theming.

## Key Components

### DNS Hooks
- **Custom domain mapping**: Space/Org → custom domain
- **DNS verification**: TXT record validation
- **SSL provisioning**: Automatic certificate generation
- **Domain validation**: Prevent conflicts and typos

### CORS Hooks
- **Dynamic CORS**: Allow origins based on custom domains
- **Database-driven**: Store allowed origins per space/org
- **Wildcard support**: `*.customdomain.com`
- **Security**: Prevent CORS bypass attempts

### Theming
- **Per-space themes**: Logo, colors, fonts (TODO.md line 122)
- **CSS variables**: Dynamic theme injection
- **Preview**: Live theme preview in admin
- **Fallback**: Default theme if none configured

### Branding
- **Logo upload**: Space/Org logos
- **Favicon**: Custom favicons per domain
- **Email branding**: Custom email templates
- **Legal pages**: Custom ToS, Privacy Policy

## Reference

- User note: "Hooks into DNS and CORS systems"
- TODO.md: Lines 122-126 (White-label/theming)

## Related Tickets

- **Blocked by**: INFRA-001 (DNS setup in init script)
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
