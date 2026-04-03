import type { User } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { userCreatedEvent } from '#/appEvents/definitions';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import type { AppEnv } from '#/types/appEnv';

type GuestParams = {
  email: string;
  name?: string;
};

export const findUserOrCreateGuest = async (c: Context<AppEnv>, { email, name }: GuestParams): Promise<User> => {
  const db = c.get('db');
  const normalized = normalizeEmail(email);

  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) return existing;

  return db.txn(async () => {
    const doubleCheck = await db.user.findUnique({ where: { email: normalized } });
    if (doubleCheck) return doubleCheck;

    const guest = await db.user.create({
      data: {
        email: normalized,
        name,
        emailVerified: false,
      },
    });

    await userCreatedEvent.emit(
      { userId: guest.id, isGuest: true },
      { resourceType: 'User', resourceId: guest.id },
    );

    return guest;
  });
};
