import type { ExtendedPrismaClient, User } from '@template/db';
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
  db: ExtendedPrismaClient,
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
