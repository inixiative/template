import type { User } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';

type GuestParams = {
  email: string;
  name?: string;
};

export const findUserOrCreateGuest = async (c: Context<AppEnv>, { email, name }: GuestParams): Promise<User> => {
  const db = c.get('db');
  const normalized = normalizeEmail(email);

  return db.user.upsert({
    where: { email: normalized },
    update: {},
    create: {
      email: normalized,
      name,
      emailVerified: false,
    },
  });
};
