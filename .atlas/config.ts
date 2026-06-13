import { defineConfig, partOfFor } from '@inixiative/atlas/config';

export default defineConfig({
  include: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx'],
  ignore: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/tests/**',
    '**/__tests__/**',
    '**/index.ts',
    '**/*.d.ts',
    '**/dist/**',
    '**/generated/**', // Prisma client + zod schemas — generated, not authored
    '**/*.gen.ts',
    '**/*.config.ts', // build tooling (vite/app/prisma/openapiTs config) — not app source
    '**/scripts/**', // codegen / build scripts
    '**/watchAndGenerate.ts',
    '**/test/**', // test infra (factories, mocks, setup) — singular, complements **/tests/**
    '**/*.example.tsx',
  ],
  stamp: [
    // @kind — structural globs (no capture)
    { include: '**/controllers/**', kind: 'controller' },
    { include: 'apps/api/src/**/routes/**', kind: 'route' }, // backend HTTP routes
    { include: '**/services/**', kind: 'service' },
    { include: '**/queries/**', kind: 'query' },
    { include: '**/schemas/**', kind: 'schema' },
    { include: '**/validations/**', kind: 'validator' },
    { include: '**/handlers/**', kind: 'handler' },
    { include: '**/middleware/**', kind: 'middleware' },
    { include: ['**/constants/**', '**/constants.ts'], kind: 'constant' },
    { include: ['**/utils/**', '**/utils.ts'], kind: 'utils' },
    // structural roles common in packages + frontend
    { include: ['**/types/**', '**/*.types.ts'], kind: 'type' },
    { include: '**/factories/**', kind: 'factory' },
    { include: ['**/client.ts', '**/*.client.ts', '**/client/**', '**/clients/**'], kind: 'client' },
    { include: ['**/registries/**', '**/registry.ts'], kind: 'registry' },
    { include: '**/bridges/**', kind: 'bridge' },
    { include: '**/defs/**', kind: 'definition' },
    { include: '**/*Error.ts', kind: 'error' },
    { include: '**/generate*.ts', kind: 'generator' },
    { include: ['**/schema.ts', '**/schemas.ts', '**/*.schema.ts'], kind: 'schema' }, // bare schema files (incl. in handlers/)
    { include: '**/types.ts', kind: 'type' }, // bare types.ts not in a types/ folder
    { include: '**/*.config.ts', kind: 'config' },
    { include: ['**/seed.ts', '**/*.seed.ts', '**/seeds/**'], kind: 'seed' },
    { include: '**/components/**', kind: 'component' },
    { include: ['**/store/**', '**/*.store.ts'], kind: 'store' },
    // React hooks only (frontend + ui pkg) — NOT apps/api/src/hooks (those are db lifecycle handlers)
    { include: ['packages/ui/**/hooks/**', 'apps/web/**/hooks/**', 'apps/admin/**/hooks/**', 'apps/superadmin/**/hooks/**'], kind: 'hook' },
    // frontend (TanStack apps): file-based routes are pages, app bootstrap is an entrypoint
    { include: ['apps/web/**/routes/**', 'apps/admin/**/routes/**', 'apps/superadmin/**/routes/**'], kind: 'page' },
    { include: ['apps/*/app/main.tsx', 'apps/*/app/client.tsx', 'apps/*/app/router.tsx', 'apps/*/app/ssr.tsx'], kind: 'entrypoint' },
    { include: 'apps/*/app/lib/**', kind: 'utils' },
    { include: 'apps/*/app/config/**', kind: 'config' },
    { include: 'apps/*/app/guards/**', kind: 'middleware' },
    // @partOf — resolve a captured segment through membership (multi-@partOf normal)
    // exclude admin/: it's a positional grouping, not a feature module ($1 would be 'admin').
    { include: 'apps/api/src/modules/$1/**', exclude: 'apps/api/src/modules/admin/**', partOf: partOfFor('module', '$1') },
    // admin sub-modules map to their own concept (e.g. admin/auditLog → feature:auditLogs)
    { include: 'apps/api/src/modules/admin/$1/**', partOf: partOfFor('module', '$1') },
    // top-level api dirs that ARE registered primitives — explicit, not a blanket $1 capture
    // (the old `apps/api/src/$1/**` rule phantom-tagged modules/lib/hooks/middleware/… too)
    { include: 'apps/api/src/appEvents/**', partOf: 'primitive:appEvents' },
    { include: 'apps/api/src/jobs/**', partOf: 'primitive:jobs' },
    { include: 'apps/api/src/ws/**', partOf: 'primitive:websockets' },
    { include: 'packages/$1/**', partOf: partOfFor('package', '$1') },
    // wire concepts whose code lives outside a module/package folder:
    { include: ['apps/api/src/lib/routeTemplates/**', 'apps/api/src/lib/utils/makeController.ts'], partOf: 'primitive:routeTemplates' },
    { include: ['apps/api/src/lib/auth.ts', 'apps/api/src/middleware/auth/**'], partOf: 'feature:auth' },
    { include: ['apps/api/src/lib/webhooks/**', 'apps/api/src/hooks/webhookSubscriptionUrl/**'], partOf: 'feature:webhooks' },
    { include: ['packages/db/src/redis/**', 'packages/db/src/lock/**'], partOf: 'infrastructure:redis' },
    // api lib/middleware primitives + infrastructure + external integrations
    { include: ['apps/api/src/lib/context/**', 'apps/api/src/middleware/resources/**'], partOf: 'primitive:requestContext' },
    { include: ['apps/api/src/lib/errors/**', 'apps/api/src/middleware/error/**'], partOf: 'primitive:errors' },
    { include: 'apps/api/src/lib/messaging/**', partOf: 'primitive:messaging' },
    { include: 'apps/api/src/lib/shutdown.ts', partOf: 'primitive:lifecycle' },
    { include: ['apps/api/src/lib/storage/**', 'apps/api/src/lib/clients/s3.ts'], partOf: 'infrastructure:storage' },
    { include: ['apps/api/src/config/otel.ts', 'apps/api/src/lib/observe.ts', 'apps/api/src/lib/errorReporter/**'], partOf: 'infrastructure:observability' },
    { include: 'apps/api/src/config/env.ts', partOf: 'infrastructure:env' },
    { include: 'apps/api/src/lib/clients/stripe.ts', partOf: 'integration:stripe' },
    { include: 'packages/email/src/client/resend.ts', partOf: 'integration:resend' },
    // superadmin (classless, derived): the BE admin folder + admin-prefixed
    // controllers/routes anywhere + the superadmin app.
    { include: 'apps/api/src/modules/admin/**', partOf: 'superadmin' },
    { include: ['**/controllers/admin*.ts', '**/routes/admin*.ts'], partOf: 'superadmin' },
    { include: 'apps/superadmin/**', partOf: 'superadmin' },
  ],
  references: {
    // only docs are existence-checked; ticket ids are kept for invert() but their
    // filenames are slugged, so they are not resolved to paths here.
    docs: (v) => `docs/claude/${v}`,
  },
});
