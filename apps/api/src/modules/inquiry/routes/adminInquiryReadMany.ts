import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

const querySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
});

export const adminInquiryReadManyRoute = readRoute({
  model: Modules.inquiry,
  many: true,
  paginate: true,
  admin: true,
  query: querySchema,
  responseSchema: InquiryModelSchema,
});
