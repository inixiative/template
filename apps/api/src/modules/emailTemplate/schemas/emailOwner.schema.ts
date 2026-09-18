/**
 * @atlas
 * @kind schema
 * @partOf feature:email
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { EmailOwnerModel } from '@template/db/generated/client/enums';

export const emailOwnerSchema = z.object({
  ownerModel: z.nativeEnum(EmailOwnerModel).default(EmailOwnerModel.default),
  organizationId: z.string().uuid().nullish(),
  spaceId: z.string().uuid().nullish(),
  userId: z.string().uuid().nullish(),
});
