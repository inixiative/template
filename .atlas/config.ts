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
    { include: 'apps/api/src/modules/$1/**', partOf: partOfFor('module', '$1') },
    // admin sub-modules also map to their own feature (e.g. admin/auditLog → feature:auditLogs)
    { include: 'apps/api/src/modules/admin/$1/**', partOf: partOfFor('module', '$1') },
    // top-level api dirs (appEvents/jobs/ws/…) map to their primitive if registered
    { include: 'apps/api/src/$1/**', partOf: partOfFor('module', '$1') },
    { include: 'packages/$1/**', partOf: partOfFor('package', '$1') },
    // wire concepts whose code lives outside a module/package folder:
    { include: ['apps/api/src/lib/routeTemplates/**', 'apps/api/src/lib/utils/makeController.ts'], partOf: 'primitive:routeTemplates' },
    { include: ['apps/api/src/lib/auth.ts', 'apps/api/src/middleware/auth/**'], partOf: 'feature:auth' },
    { include: ['packages/db/src/redis/**', 'packages/db/src/lock/**'], partOf: 'infrastructure:redis' },
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
