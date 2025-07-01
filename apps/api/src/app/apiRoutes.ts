import { Elysia } from 'elysia';
import { coreRoutes } from 'src/app/core/coreRoutes';
import { adminRoutes } from 'src/app/admin/adminRoutes';

export const apiRoutes = new Elysia({ name: 'apiRoutes', prefix: '/api' })
  .use(coreRoutes)
  .use(adminRoutes);
