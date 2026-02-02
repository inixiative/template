import type { Db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';

type GuestParams = {
  email: string;
  name?: string;
};

/**
 * Find existing user by email or create a guest user.
 * Guest users have emailVerified=false and no linked accounts.
 */
export async function findUserOrCreateGuest(
  db: Db,
  { email, name }: GuestParams,
): Promise<User> {
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
}
