import { createHash, randomBytes } from 'node:crypto';
import { createToken } from '@template/db/test';

export const createKeyedToken = async (...[data, context]: Parameters<typeof createToken>) => {
  const rawKey = randomBytes(24).toString('hex');
  const created = await createToken(
    {
      ...data,
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 16),
    },
    context,
  );
  return { ...created, rawKey };
};
