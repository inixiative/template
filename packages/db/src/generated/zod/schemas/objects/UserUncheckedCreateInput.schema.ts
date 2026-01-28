import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema as AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './AccountUncheckedCreateNestedManyWithoutUserInput.schema';
import { SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema as SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './SessionUncheckedCreateNestedManyWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutUserInput.schema';
import { TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema as TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutUserInput.schema';
import { CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateNestedManyWithoutCreatedByInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  email: z.string(),
  emailVerified: z.boolean().optional(),
  name: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  platformRole: PlatformRoleSchema.optional(),
  accounts: z.lazy(() => AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  organizationUsers: z.lazy(() => OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobUncheckedCreateNestedManyWithoutCreatedByInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema).optional()
}).strict();
export const UserUncheckedCreateInputObjectSchema: z.ZodType<Prisma.UserUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedCreateInput>;
export const UserUncheckedCreateInputObjectZodSchema = makeSchema();
