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
    { include: '**/routes/**', kind: 'route' },
    { include: '**/services/**', kind: 'service' },
    { include: '**/queries/**', kind: 'query' },
    { include: '**/schemas/**', kind: 'schema' },
    { include: '**/validations/**', kind: 'validator' },
    { include: '**/handlers/**', kind: 'handler' },
    { include: '**/middleware/**', kind: 'middleware' },
    { include: ['**/constants/**', '**/constants.ts'], kind: 'constant' },
    { include: ['**/utils/**', '**/utils.ts'], kind: 'utils' },
    // @partOf — resolve a captured segment through membership (multi-@partOf normal)
    { include: 'apps/api/src/modules/$1/**', partOf: partOfFor('module', '$1') },
    // admin sub-modules also map to their own feature (e.g. admin/auditLog → feature:auditLogs)
    { include: 'apps/api/src/modules/admin/$1/**', partOf: partOfFor('module', '$1') },
    { include: 'packages/$1/**', partOf: partOfFor('package', '$1') },
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
