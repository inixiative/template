import { Elysia } from 'elysia';
import { auth } from 'src/app/core/middleware/auth/auth';
import { corsMiddleware } from 'src/app/core/middleware/cors';
import { errorBoundary } from 'src/app/core/middleware/errorBoundary';
import { exampleMiddleware } from 'src/app/core/middleware/example';
import { userContext } from 'src/app/core/middleware/user/userContext';
import { resourceContext } from 'src/app/core/middleware/resource/resourceContext';
import { telemetry } from 'src/app/core/middleware/telemetry';

export const middleware = (app: Elysia) => {
  app.use(errorBoundary);
  
  if (process.env.OTEL_ENABLED === 'true') app.use(telemetry);
  
  app.use(corsMiddleware);
  
  if (process.env.AUTH_ENABLED) app.use(auth);
  
  app.use(userContext);
  app.use(resourceContext);
  
  // if (process.env.EXAMPLE_MIDDLEWARE_ENABLED) app.use(exampleMiddleware);
  
  return app;
};
