import { Elysia } from 'elysia';
import { userRoutes } from 'src/app/core/users/routes/userRoutes';

export const coreRoutes = new Elysia({ name: 'coreRoutes', prefix: '/core' })
  .use(userRoutes);
