import { Elysia } from 'elysia';
import { queueRoutes } from 'src/app/admin/queue/routes/queueRoutes';

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(queueRoutes);