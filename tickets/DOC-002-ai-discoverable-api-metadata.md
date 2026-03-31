# DOC-002: AI-Discoverable API Metadata

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-31
**Updated**: 2026-03-31

---

## Overview

Make the public API discoverable by AI agents and LLM-powered tools by embedding structured metadata into web-facing pages. An agent visiting the site should be able to find the API docs URL, understand what the API offers, and know where to get the OpenAPI spec — without needing a browser or guessing URLs.

## Objectives

- ✅ AI agents can discover API documentation from the public-facing web app
- ✅ Standard metadata conventions used so agents and search engines both benefit

---

## Tasks

### Page Metadata (apps/web)

- [ ] Add `<link rel="api" href="{API_URL}/openapi/docs" type="application/openapi+json">` to the HTML `<head>`
- [ ] Add `<meta name="api-docs" content="{API_URL}/reference">` pointing to the Scalar UI (from DOC-001)
- [ ] Add a human-readable "API Docs" or "Developers" link in the site header/footer

### API Server (apps/api)

- [ ] Serve a `/.well-known/api-docs` JSON endpoint returning:
  ```json
  {
    "openapi_spec": "/openapi/docs",
    "documentation": "/reference",
    "version": "0.1.0"
  }
  ```
  This follows the `.well-known` convention that agents and tooling already look for.

### robots.txt / llms.txt (optional, recommended)

- [ ] Add or update `robots.txt` to explicitly allow `/openapi/docs` and `/reference`
- [ ] Consider adding `llms.txt` (emerging convention) with a brief description of the API and link to the spec

### Structured Data (optional)

- [ ] Add JSON-LD `WebAPI` schema markup to the landing page:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    "name": "Template API",
    "documentation": "{API_URL}/reference",
    "url": "{API_URL}/openapi/docs"
  }
  ```

---

## Implementation Notes

The core idea: an AI agent should be able to visit the root URL of either the web app or API and discover the full API surface within one hop. Three complementary signals:

1. **HTML metadata** — `<link>` and `<meta>` tags in the web app `<head>` (for agents that render/parse HTML)
2. **`.well-known` endpoint** — machine-readable JSON at a standard path (for agents that probe well-known URLs)
3. **Human-visible link** — a "Developers" or "API" link in navigation (for agents that read page content)

### Key files

- `apps/web/index.html` or root layout — HTML metadata
- `apps/api/src/app.ts` or new route — `.well-known/api-docs` endpoint
- `apps/web` header/footer component — visible link

### Open question

- Should the web app link go to the Scalar UI on the API server, or should we proxy/embed the docs in the web app itself? Linking out is simpler; embedding gives a more integrated feel.

---

## Definition of Done

- [ ] `<link rel="api">` tag present in web app HTML head
- [ ] `/.well-known/api-docs` returns correct JSON from API server
- [ ] At least one visible link to API docs in the web app UI
- [ ] An AI agent hitting the root URL can find the OpenAPI spec within one hop
- [ ] `bun run check` passes

---

## Related Tickets

- DOC-001: Scalar API Documentation UI (dependency — Scalar must be set up first)
- FEAT-014: AI Developer Experience

---

_Stub ticket — expand when prioritized._
