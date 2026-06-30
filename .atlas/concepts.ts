import type { ConceptRegistry } from '@inixiative/atlas';

// Repo-OWNED concept registry — structure only. Classes are the layers
// (feature / primitive / infrastructure); `module`/`package` are the constituent
// categories that fill @partOf during stamping.
export const CONCEPTS: ConceptRegistry = {
  'feature:auth': { module: ['token', 'authProvider'], docs: ['AUTH.md'] },
  'feature:tenancy': { module: ['organization', 'space', 'organizationUser', 'spaceUser'] },
  'feature:users': { module: ['user', 'me'] },
  'feature:inquiry': { module: ['inquiry'], docs: ['INQUIRIES.md'] },
  'feature:contact': { module: ['contact'] },
  'feature:customer': { module: ['customerRef'] },
  'feature:auditLogs': { module: ['auditLog'], docs: ['HOOKS.md'] }, // lives under modules/admin/, but is its own feature
  'feature:cronJob': { module: ['cronJob'] }, // admin/cronJob — scheduled job management (own model + CRUD)
  'primitive:caching': { module: ['cache'], docs: ['REDIS.md'] }, // built on infrastructure:redis
  'feature:webhooks': { module: ['webhookSubscription'], docs: ['HOOKS.md'] },
  'feature:email': { package: ['email'], docs: ['COMMUNICATIONS.md'] },

  // classless cross-cutting tag (derived): the BE admin surface IS superadmin.
  superadmin: {},

  'primitive:authz': { package: ['permissions'], docs: ['PERMISSIONS.md'] },
  'primitive:batch': { module: ['batch'], docs: ['BATCH.md'] },
  'primitive:ui': { package: ['ui'], docs: ['FRONTEND.md', 'ZUSTAND.md'] }, // the component library
  'primitive:shared': { package: ['shared'], docs: ['CONCURRENCY.md', 'LOGGING.md', 'ENCRYPTION.md'] }, // shared utils/types
  'primitive:sdk': { package: ['sdk'] }, // generated API client
  'primitive:appEvents': { module: ['appEvents'], docs: ['APP_EVENTS.md'] },
  'primitive:jobs': { module: ['jobs', 'job'], docs: ['JOBS.md'] }, // 'job' = admin/job enqueue surface
  'primitive:websockets': { module: ['ws'], docs: ['WEBSOCKETS.md', 'APP_EVENTS.md'] },
  'primitive:routeTemplates': { docs: ['API_ROUTES.md'] },
  'primitive:adapter': { docs: ['ADAPTERS.md'] },

  'primitive:requestContext': { docs: ['CONTEXT.md'] }, // request-scoped actor/resource context
  'primitive:errors': { docs: ['API_ROUTES.md'] }, // error model + HTTP error formatting
  'primitive:messaging': {}, // multi-channel message delivery
  'primitive:lifecycle': {}, // process lifecycle / graceful shutdown

  'infrastructure:prisma': { package: ['db'], docs: ['DATABASE.md'] },
  'infrastructure:seed': {}, // canonical baseline data + the hook-aware runner that loads it (spans db + api)
  'infrastructure:redis': { docs: ['REDIS.md'] },
  'infrastructure:storage': { docs: ['ADAPTERS.md'] }, // object storage (s3)
  'infrastructure:observability': { docs: ['LOGGING.md'] }, // otel / sentry / error reporting
  'infrastructure:env': { docs: ['ENVIRONMENTS.md'] }, // env schema + validation

  // integration: — the external-service boundary layer (4th concept class)
  'integration:stripe': {},
  'integration:resend': {},
};
