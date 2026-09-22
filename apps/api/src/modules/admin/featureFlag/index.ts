import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { featureFlagCreateController } from '#/modules/admin/featureFlag/controllers/featureFlagCreate';
import { featureFlagReadManyController } from '#/modules/admin/featureFlag/controllers/featureFlagReadMany';
import { featureFlagCreateRoute } from '#/modules/admin/featureFlag/routes/featureFlagCreate';
import { featureFlagReadManyRoute } from '#/modules/admin/featureFlag/routes/featureFlagReadMany';
import type { AppEnv } from '#/types/appEnv';

export const adminFeatureFlagRouter = new OpenAPIHono<AppEnv>();

adminFeatureFlagRouter.openapi(toOpenApi(featureFlagReadManyRoute), featureFlagReadManyController);
adminFeatureFlagRouter.openapi(toOpenApi(featureFlagCreateRoute), featureFlagCreateController);
