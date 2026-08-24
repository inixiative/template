import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@template/db/generated/client/client';
import { createToken } from '@template/db/test';

// A real Token row plus its raw key — the credential external callers (MCP, integrations)
// present. The factory only stores the hash, so the raw key is minted here.
export const createBearerToken = async (user: User) => {
  const rawKey = randomBytes(24).toString('hex');
  const { entity: token } = await createToken(
    { keyHash: createHash('sha256').update(rawKey).digest('hex'), keyPrefix: rawKey.slice(0, 16) },
    { user },
  );
  return { token, rawKey, authorization: `Bearer ${rawKey}` };
};
