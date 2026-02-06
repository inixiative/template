# FEAT-006: Localization (i18n)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Low
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement internationalization (i18n) support for multi-language SaaS with translation management, locale detection, and RTL support.

## Key Components

- **i18n library**: `react-intl`, `next-intl`, or `i18next`
- **Translation files**: JSON per locale (`en.json`, `es.json`, etc.)
- **Locale detection**: Browser settings, user preference, domain
- **Translation UI**: Admin interface for managing translations
- **Pluralization**: Handle plural forms per language
- **Date/time formatting**: Locale-aware formatting
- **Number formatting**: Currency, percentages
- **RTL support**: Right-to-left languages (Arabic, Hebrew)

## Workflow

1. Developer wraps strings: `<FormattedMessage id="welcome.title" />`
2. Extract strings: `bun run i18n:extract`
3. Translator fills translations in admin UI or JSON files
4. User selects language in settings
5. App renders in user's language

## Reference

- TODO.md: Line 99 (I18n package)

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
