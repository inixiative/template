import { db } from '@template/db';

// Forbidden: select narrows the create result the lifecycle hooks consume.
export async function makeToken(organizationId: string) {
  return db.token.create({
    data: { organizationId, name: 'ci' },
    select: { id: true },
  });
}
