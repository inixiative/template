import type { User } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { emitAppEvent } from '#/appEvents/emit';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import type { AppEnv } from '#/types/appEnv';

type GuestParams = {
  email: string;
  name?: string;
};

export const findUserOrCreateGuest = async (c: Context<AppEnv>, { email, name }: GuestParams): Promise<User> => {
  const db = c.get('db');
  const normalized = normalizeEmail(email);

  const user = await db.user.upsert({
    where: { email: normalized },
    update: {},
    create: {
      email: normalized,
      name,
      emailVerified: false,
    },
  });

  const isNew = Date.now() - user.createdAt.getTime() < 5000;

  if (isNew) {
    await emitAppEvent('user.created', { userId: user.id, isGuest: true }, {
      resourceType: 'User',
      resourceId: user.id,
    });
  }

  return user;
};
