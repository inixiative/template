import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema as AccountUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './AccountUncheckedCreateNestedManyWithoutUserInput.schema';
import { SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema as SessionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './SessionUncheckedCreateNestedManyWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateNestedManyWithoutUserInput.schema';
import { TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema as TokenUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutUserInput.schema';
import { WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema as WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema } from './WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutSourceUserInput.schema';
import { InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema as InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema } from './InquiryUncheckedCreateNestedManyWithoutTargetUserInput.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
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
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedCreateNestedManyWithoutUserInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutSourceUserInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedCreateNestedManyWithoutTargetUserInputObjectSchema).optional()
}).strict();
export const UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutCronJobsCreatedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedCreateWithoutCronJobsCreatedInput>;
export const UserUncheckedCreateWithoutCronJobsCreatedInputObjectZodSchema = makeSchema();
