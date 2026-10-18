import { routes } from '#/routes';

export const app = new OpenAPIHono();
app.use('*', telemetryMiddleware);
app.route('/', routes);
app.doc31('/openapi/docs', { openapi: '3.1.0' });
