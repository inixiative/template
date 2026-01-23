import { makeController } from '@src/lib/utils/makeController';
import { loginRoute } from '../routes/login.route';
import { verifyPassword } from '../services/password';
import { signJwt } from '../services/jwt';

export const loginController = makeController(loginRoute, async (c, respond) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  // Find user by email
  const user = await db.user.findUnique({
    where: { email: body.email },
  });

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password' }, 401);
  }

  // Verify password
  const valid = await verifyPassword(body.password, user.passwordHash);

  if (!valid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password' }, 401);
  }

  // Generate JWT
  const token = await signJwt(user.id, user.email);

  return respond.ok({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    },
  });
});
