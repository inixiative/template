/**
 * @atlas
 * @kind entrypoint
 * @uses primitive:routeTemplates, primitive:flows
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerSecuritySchemes } from '#/lib/auth/securitySchemes';
import { routeByOperationId } from '#/lib/routeTemplates/routeIndex';
import { errorHandlerMiddleware } from '#/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '#/middleware/error/notFoundHandlerMiddleware';
import { telemetryMiddleware } from '#/middleware/telemetryMiddleware';
import { flowDefinitions } from '#/modules/flow/definitions';
import { assertValidFlowDefinitions } from '#/modules/flow/validations/flowDefinitionIssues';
import { Tags } from '#/modules/tags';
import { routes } from '#/routes';
import type { AppEnv } from '#/types/appEnv';

export const app = new OpenAPIHono<AppEnv>();

app.use('*', telemetryMiddleware);

// Make app available in context
app.use('*', (c, next) => {
  c.set('app', app);
  return next();
});

// Error handling
app.onError(errorHandlerMiddleware);

// Mount all routes
app.route('/', routes);
assertValidFlowDefinitions(flowDefinitions, routeByOperationId);

// OpenAPI
registerSecuritySchemes(app);
app.doc31('/openapi/docs', {
  openapi: '3.1.0',
  info: { title: `${process.env.PROJECT_NAME ?? 'Template'} API`, version: '0.1.0' },
  tags: Object.values(Tags).map((name) => ({ name })),
});

// Not found (must be last)
app.notFound(notFoundHandlerMiddleware);
