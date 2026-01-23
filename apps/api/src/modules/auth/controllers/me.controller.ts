import { makeController } from '@src/lib/utils/makeController';
import { meRoute } from '../routes/me.route';

export const meController = makeController(meRoute, async (c, respond) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Not authenticated' }, 401);
  }

  const db = c.get('db');

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
  });

  if (!fullUser) {
    return c.json({ error: 'Unauthorized', message: 'User not found' }, 401);
  }

  return respond.ok({
    id: fullUser.id,
    email: fullUser.email,
    name: fullUser.name,
    emailVerified: fullUser.emailVerified,
    kycStatus: fullUser.kycStatus,
    createdAt: fullUser.createdAt.toISOString(),
  });
});
