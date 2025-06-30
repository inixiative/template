import { Elysia } from 'elysia';

export const userRoutes = new Elysia({ name: 'userRoutes', prefix: '/users' })
  .get('/', ({ db }) => {
    if (!db) return { error: 'Database not available' };
    return { message: 'Users endpoint' };
  })
  .get('/:id', ({ params: { id } }) => {
    return { id, message: `User ${id}` };
  });
