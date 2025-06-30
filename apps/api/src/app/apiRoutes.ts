import { Elysia } from 'elysia';
import { coreRoutes } from 'src/app/core/coreRoutes';

export const apiRoutes = new Elysia({ name: 'apiRoutes', prefix: '/api' })
  .use(coreRoutes);
