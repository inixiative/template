import { Elysia } from 'elysia';
import { queueRoutes } from 'src/app/admin/queue/queueRoutes.ts';

export const adminModuleRoutes = new Elysia({ name: 'adminModule', prefix: '/admin' })
  .use(queueRoutes);
