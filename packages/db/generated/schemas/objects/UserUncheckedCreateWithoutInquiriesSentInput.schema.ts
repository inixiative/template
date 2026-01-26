import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema as AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './AccountUncheckedCreateNestedManyWithoutUserInput.schema';
import { SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema as SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './SessionUncheckedCreateNestedManyWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutUserInput.schema';
import { TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema as TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutUserInput.schema';
import { CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateNestedManyWithoutCreatedByInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  email: z.string(),
  emailVerified: z.boolean().optional(),
  name: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  platformRole: PlatformRoleSchema.optional(),
  accounts: z.lazy(() => AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  organizations: z.lazy(() => OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema).optional()
}).strict();
export const UserUncheckedCreateWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedCreateWithoutInquiriesSentInput>;
export const UserUncheckedCreateWithoutInquiriesSentInputObjectZodSchema = makeSchema();
