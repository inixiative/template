import type { ConceptRegistry } from '@inixiative/atlas';

// Repo-OWNED concept registry — structure only. Classes are the layers
// (feature / primitive / infrastructure); `module`/`package` are the constituent
// categories that fill @partOf during stamping.
export const CONCEPTS: ConceptRegistry = {
  'feature:auth': { module: ['token', 'authProvider'], docs: ['AUTH.md'] },
  'feature:tenancy': { module: ['organization', 'space', 'organizationUser', 'spaceUser'] },
  'feature:users': { module: ['user', 'me'] },
  'feature:inquiry': { module: ['inquiry'] },
  'feature:contact': { module: ['contact'] },
  'feature:customer': { module: ['customerRef'] },
  'feature:auditLogs': { module: ['auditLog'] }, // lives under modules/admin/, but is its own feature
  'primitive:caching': { module: ['cache'], docs: ['REDIS.md'] }, // built on infrastructure:redis
  'feature:webhooks': { module: ['webhookSubscription'] },
  'feature:email': { package: ['email'], docs: ['COMMUNICATIONS.md'] },

  // classless cross-cutting tag (derived): the BE admin surface IS superadmin.
  superadmin: {},

  'primitive:authz': { package: ['permissions'], docs: ['PERMISSIONS.md'] },
  'primitive:batch': { module: ['batch'], docs: ['BATCH.md'] },
  'primitive:appEvents': { docs: ['APP_EVENTS.md'] },
  'primitive:jobs': { docs: ['JOBS.md'] },
  'primitive:routeTemplates': { docs: ['API_ROUTES.md'] },
  'primitive:adapter': { docs: ['ADAPTERS.md'] },

  'infrastructure:prisma': { package: ['db'], docs: ['DATABASE.md'] },
  'infrastructure:redis': { docs: ['REDIS.md'] },
};
