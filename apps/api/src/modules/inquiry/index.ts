import { OpenAPIHono } from '@hono/zod-openapi';
import { validateActor } from '#/middleware/validations/validateActor';
import { adminInquiryReadManyController } from '#/modules/inquiry/controllers/adminInquiryReadMany';
import { inquiryCancelController } from '#/modules/inquiry/controllers/inquiryCancel';
import { inquiryCreateController } from '#/modules/inquiry/controllers/inquiryCreate';
import { inquiryReadController } from '#/modules/inquiry/controllers/inquiryRead';
import { inquiryReceivedController } from '#/modules/inquiry/controllers/inquiryReceived';
import { inquiryResolveController } from '#/modules/inquiry/controllers/inquiryResolve';
import { inquirySendController } from '#/modules/inquiry/controllers/inquirySend';
import { inquirySentController } from '#/modules/inquiry/controllers/inquirySent';
import { inquiryUpdateController } from '#/modules/inquiry/controllers/inquiryUpdate';
import { adminInquiryReadManyRoute } from '#/modules/inquiry/routes/adminInquiryReadMany';
import { inquiryCancelRoute } from '#/modules/inquiry/routes/inquiryCancel';
import { inquiryCreateRoute } from '#/modules/inquiry/routes/inquiryCreate';
import { inquiryReadRoute } from '#/modules/inquiry/routes/inquiryRead';
import { inquiryReceivedRoute } from '#/modules/inquiry/routes/inquiryReceived';
import { inquiryResolveRoute } from '#/modules/inquiry/routes/inquiryResolve';
import { inquirySendRoute } from '#/modules/inquiry/routes/inquirySend';
import { inquirySentRoute } from '#/modules/inquiry/routes/inquirySent';
import { inquiryUpdateRoute } from '#/modules/inquiry/routes/inquiryUpdate';
import type { AppEnv } from '#/types/appEnv';

export const inquiryRouter = new OpenAPIHono<AppEnv>();

inquiryRouter.use('*', validateActor);

inquiryRouter.openapi(inquiryCreateRoute, inquiryCreateController);
inquiryRouter.openapi(inquiryReadRoute, inquiryReadController);
inquiryRouter.openapi(inquirySentRoute, inquirySentController);
inquiryRouter.openapi(inquiryReceivedRoute, inquiryReceivedController);
inquiryRouter.openapi(inquiryUpdateRoute, inquiryUpdateController);
inquiryRouter.openapi(inquirySendRoute, inquirySendController);
inquiryRouter.openapi(inquiryResolveRoute, inquiryResolveController);
inquiryRouter.openapi(inquiryCancelRoute, inquiryCancelController);

export const adminInquiryRouter = new OpenAPIHono<AppEnv>();

adminInquiryRouter.openapi(adminInquiryReadManyRoute, adminInquiryReadManyController);
