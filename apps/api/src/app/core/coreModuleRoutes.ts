import { Elysia } from 'elysia';
import { userRoutes } from 'src/app/core/users/userRoutes.ts';

export const coreModuleRoutes = new Elysia({ name: 'coreModule', prefix: '/core' })
  .use(userRoutes);
