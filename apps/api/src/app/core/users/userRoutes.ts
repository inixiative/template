import { Elysia, t } from 'elysia';
import { resource, update } from 'src/app/core/requestSchemas';
import { usersCurrent } from 'src/app/core/users/controllers/usersCurrent.ts';
import { usersUpdateCurrent } from 'src/app/core/users/controllers/usersUpdateCurrent.ts';
import { userWithAccountsSchema } from 'src/app/core/users/schemas/userSchema.ts';

export const userRoutes = new Elysia({ name: 'userRoutes', prefix: '/users' })
  .get('/current', usersCurrent, resource('user', userWithAccountsSchema, { 
    noId: true, 
    requireAuth: true,
    tags: ['users']
  }))
  .put('/current', usersUpdateCurrent, update('user', userWithAccountsSchema, {
    noId: true,
    requireAuth: true,
    tags: ['users']
  }))
  .post('/test', async ({ db, body }) => {
    const user = await db.user.create({
      data: {
        username: body.username || `test-${Date.now()}`,
        name: body.name || 'Test User'
      }
    });
    
    return user;
  }, {
    body: t.Object({
      username: t.Optional(t.String()),
      name: t.Optional(t.String())
    })
  });
