import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { AccountCreateNestedManyWithoutUserInputObjectSchema as AccountCreateNestedManyWithoutUserInputObjectSchema } from './AccountCreateNestedManyWithoutUserInput.schema';
import { SessionCreateNestedManyWithoutUserInputObjectSchema as SessionCreateNestedManyWithoutUserInputObjectSchema } from './SessionCreateNestedManyWithoutUserInput.schema';
import { TokenCreateNestedManyWithoutUserInputObjectSchema as TokenCreateNestedManyWithoutUserInputObjectSchema } from './TokenCreateNestedManyWithoutUserInput.schema';
import { CronJobCreateNestedManyWithoutCreatedByInputObjectSchema as CronJobCreateNestedManyWithoutCreatedByInputObjectSchema } from './CronJobCreateNestedManyWithoutCreatedByInput.schema';
import { WebhookSubscriptionCreateNestedManyWithoutUserInputObjectSchema as WebhookSubscriptionCreateNestedManyWithoutUserInputObjectSchema } from './WebhookSubscriptionCreateNestedManyWithoutUserInput.schema';
import { InquiryCreateNestedManyWithoutSourceUserInputObjectSchema as InquiryCreateNestedManyWithoutSourceUserInputObjectSchema } from './InquiryCreateNestedManyWithoutSourceUserInput.schema';
import { InquiryCreateNestedManyWithoutTargetUserInputObjectSchema as InquiryCreateNestedManyWithoutTargetUserInputObjectSchema } from './InquiryCreateNestedManyWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  email: z.string(),
  emailVerified: z.boolean().optional(),
  name: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  platformRole: PlatformRoleSchema.optional(),
  accounts: z.lazy(() => AccountCreateNestedManyWithoutUserInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionCreateNestedManyWithoutUserInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenCreateNestedManyWithoutUserInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobCreateNestedManyWithoutCreatedByInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionCreateNestedManyWithoutUserInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryCreateNestedManyWithoutSourceUserInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryCreateNestedManyWithoutTargetUserInputObjectSchema).optional()
}).strict();
export const UserCreateWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.UserCreateWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateWithoutOrganizationUsersInput>;
export const UserCreateWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
