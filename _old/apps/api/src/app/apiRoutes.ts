import { Elysia } from 'elysia';
import { coreModuleRoutes } from 'src/app/core/coreModuleRoutes';
import { adminModuleRoutes } from 'src/app/admin/adminModuleRoutes';

export const apiRoutes = new Elysia({ name: 'apiRoutes', prefix: '/api' })
  .use(coreModuleRoutes)
  .use(adminModuleRoutes);
