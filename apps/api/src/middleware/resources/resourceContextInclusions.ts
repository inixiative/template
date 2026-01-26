import type { Prisma } from '@template/db';

// Only define models that need custom inclusions
// All other models auto-infer from PrismaClient
export const resourceContextInclusions = {
  // organization: { users: true },
} as const;

export type ResourcePayloadMap = {
  // organization: Prisma.OrganizationGetPayload<{ include: typeof resourceContextInclusions.organization }>;
};
