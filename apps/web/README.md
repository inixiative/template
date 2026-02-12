# Web App

Consumer-facing frontend built with Vite + React + TanStack Router.

## Development

Run from repo root:

```bash
bun run local:web
```

Or from this workspace:

```bash
bun run dev
```

Default local port: `3000`.

## Notes

- Routes live in `app/routes`
- Route tree is generated to `app/routeTree.gen.ts` by the TanStack Router Vite plugin
- Shared app/state logic comes from `@template/shared`
- UI primitives come from `@template/ui`
