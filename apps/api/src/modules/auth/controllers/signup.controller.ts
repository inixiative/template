import { makeController } from '@src/lib/utils/makeController';
import { signupRoute } from '../routes/signup.route';
import { hashPassword } from '../services/password';
import { signJwt } from '../services/jwt';

export const signupController = makeController(signupRoute, async (c, respond) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  // Check if email already exists
  const existing = await db.user.findUnique({
    where: { email: body.email },
  });

  if (existing) {
    return c.json({ error: 'Conflict', message: 'Email already registered' }, 409);
  }

  // Hash password and create user
  const passwordHash = await hashPassword(body.password);

  const user = await db.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name || null,
    },
  });

  // Generate JWT
  const token = await signJwt(user.id, user.email);

  return respond.created({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    },
  });
});
