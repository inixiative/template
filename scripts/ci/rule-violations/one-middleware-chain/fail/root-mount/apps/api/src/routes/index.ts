import { apiRouter } from '#/routes/api';

export const routes = new OpenAPIHono();
routes.route('/health', healthRouter);
routes.route('/api', apiRouter);
routes.route('/dashboard', dashboardRouter);
