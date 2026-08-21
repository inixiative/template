import { db } from '@template/db';

// Allowed: writes return the full row; callers shape the result afterwards.
export async function makeToken(organizationId: string) {
  const { keyHash: _keyHash, ...token } = await db.token.create({
    data: { organizationId, name: 'ci', keyHash: 'x' },
  });
  return token;
}
