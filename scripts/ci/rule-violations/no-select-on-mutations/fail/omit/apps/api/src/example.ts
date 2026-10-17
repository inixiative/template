import { db } from '@template/db';

// Forbidden: omit narrows the create result the lifecycle hooks consume.
export async function makeToken(organizationId: string) {
  return db.token.create({
    data: { organizationId, name: 'ci', keyHash: 'x' },
    omit: { keyHash: true },
  });
}
