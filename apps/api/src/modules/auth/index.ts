import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@src/types/appEnv';
import { signupRoute } from './routes/signup.route';
import { loginRoute } from './routes/login.route';
import { meRoute } from './routes/me.route';
import { signupController } from './controllers/signup.controller';
import { loginController } from './controllers/login.controller';
import { meController } from './controllers/me.controller';

export const authRoutes = new OpenAPIHono<AppEnv>();

// Public routes (no auth required)
authRoutes.openapi(signupRoute, signupController);
authRoutes.openapi(loginRoute, loginController);

// Protected route (requires auth - handled by middleware)
authRoutes.openapi(meRoute, meController);

export { signupRoute, loginRoute, meRoute };
