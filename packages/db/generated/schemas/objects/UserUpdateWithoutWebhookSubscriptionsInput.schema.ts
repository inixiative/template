import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { EnumPlatformRoleFieldUpdateOperationsInputObjectSchema as EnumPlatformRoleFieldUpdateOperationsInputObjectSchema } from './EnumPlatformRoleFieldUpdateOperationsInput.schema';
import { AccountUpdateManyWithoutUserNestedInputObjectSchema as AccountUpdateManyWithoutUserNestedInputObjectSchema } from './AccountUpdateManyWithoutUserNestedInput.schema';
import { SessionUpdateManyWithoutUserNestedInputObjectSchema as SessionUpdateManyWithoutUserNestedInputObjectSchema } from './SessionUpdateManyWithoutUserNestedInput.schema';
import { OrganizationUserUpdateManyWithoutUserNestedInputObjectSchema as OrganizationUserUpdateManyWithoutUserNestedInputObjectSchema } from './OrganizationUserUpdateManyWithoutUserNestedInput.schema';
import { TokenUpdateManyWithoutUserNestedInputObjectSchema as TokenUpdateManyWithoutUserNestedInputObjectSchema } from './TokenUpdateManyWithoutUserNestedInput.schema';
import { CronJobUpdateManyWithoutCreatedByNestedInputObjectSchema as CronJobUpdateManyWithoutCreatedByNestedInputObjectSchema } from './CronJobUpdateManyWithoutCreatedByNestedInput.schema';
import { InquiryUpdateManyWithoutSourceUserNestedInputObjectSchema as InquiryUpdateManyWithoutSourceUserNestedInputObjectSchema } from './InquiryUpdateManyWithoutSourceUserNestedInput.schema';
import { InquiryUpdateManyWithoutTargetUserNestedInputObjectSchema as InquiryUpdateManyWithoutTargetUserNestedInputObjectSchema } from './InquiryUpdateManyWithoutTargetUserNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  deletedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  email: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  emailVerified: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional(),
  name: z.union([z.string(), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  image: z.union([z.string(), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  platformRole: z.union([PlatformRoleSchema, z.lazy(() => EnumPlatformRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  accounts: z.lazy(() => AccountUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  organizations: z.lazy(() => OrganizationUserUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobUpdateManyWithoutCreatedByNestedInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUpdateManyWithoutSourceUserNestedInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUpdateManyWithoutTargetUserNestedInputObjectSchema).optional()
}).strict();
export const UserUpdateWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.UserUpdateWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateWithoutWebhookSubscriptionsInput>;
export const UserUpdateWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
