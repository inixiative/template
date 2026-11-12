import type { User } from '@template/db/generated/client/client';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

export const createBearerToken = async (user: User) => {
  const { entity: token, rawKey } = await createKeyedToken({ ownerModel: 'User' }, { user });
  return { token, rawKey, authorization: `Bearer ${rawKey}` };
};
