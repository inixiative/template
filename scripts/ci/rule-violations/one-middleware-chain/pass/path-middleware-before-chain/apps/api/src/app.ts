import { routes } from '#/routes';

export const app = new OpenAPIHono();
app.use('*', telemetryMiddleware);
app.route('/', routes);
