import type { Prisma } from '@template/db';

// Include customer side relations
export const includeCustomer = {
  customerUser: true,
  customerOrganization: true,
  customerSpace: {
    include: { organization: true },
  },
} as const satisfies Prisma.CustomerRefInclude;

// Include provider side relations
export const includeProvider = {
  providerSpace: {
    include: { organization: true },
  },
} as const satisfies Prisma.CustomerRefInclude;

// Include both sides (complete)
export const includeComplete = {
  ...includeCustomer,
  ...includeProvider,
} as const satisfies Prisma.CustomerRefInclude;
