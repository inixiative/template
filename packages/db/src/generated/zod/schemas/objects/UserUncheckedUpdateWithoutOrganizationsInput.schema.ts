import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { EnumPlatformRoleFieldUpdateOperationsInputObjectSchema as EnumPlatformRoleFieldUpdateOperationsInputObjectSchema } from './EnumPlatformRoleFieldUpdateOperationsInput.schema';
import { AccountUncheckedUpdateManyWithoutUserNestedInputObjectSchema as AccountUncheckedUpdateManyWithoutUserNestedInputObjectSchema } from './AccountUncheckedUpdateManyWithoutUserNestedInput.schema';
import { SessionUncheckedUpdateManyWithoutUserNestedInputObjectSchema as SessionUncheckedUpdateManyWithoutUserNestedInputObjectSchema } from './SessionUncheckedUpdateManyWithoutUserNestedInput.schema';
import { TokenUncheckedUpdateManyWithoutUserNestedInputObjectSchema as TokenUncheckedUpdateManyWithoutUserNestedInputObjectSchema } from './TokenUncheckedUpdateManyWithoutUserNestedInput.schema';
import { CronJobUncheckedUpdateManyWithoutCreatedByNestedInputObjectSchema as CronJobUncheckedUpdateManyWithoutCreatedByNestedInputObjectSchema } from './CronJobUncheckedUpdateManyWithoutCreatedByNestedInput.schema';
import { WebhookSubscriptionUncheckedUpdateManyWithoutUserNestedInputObjectSchema as WebhookSubscriptionUncheckedUpdateManyWithoutUserNestedInputObjectSchema } from './WebhookSubscriptionUncheckedUpdateManyWithoutUserNestedInput.schema';
import { InquiryUncheckedUpdateManyWithoutSourceUserNestedInputObjectSchema as InquiryUncheckedUpdateManyWithoutSourceUserNestedInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutSourceUserNestedInput.schema';
import { InquiryUncheckedUpdateManyWithoutTargetUserNestedInputObjectSchema as InquiryUncheckedUpdateManyWithoutTargetUserNestedInputObjectSchema } from './InquiryUncheckedUpdateManyWithoutTargetUserNestedInput.schema'

const makeSchema = () => z.object({
  id: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  deletedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  email: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  emailVerified: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional(),
  name: z.union([z.string(), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  image: z.union([z.string(), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  platformRole: z.union([PlatformRoleSchema, z.lazy(() => EnumPlatformRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  accounts: z.lazy(() => AccountUncheckedUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  sessions: z.lazy(() => SessionUncheckedUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUncheckedUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  cronJobsCreated: z.lazy(() => CronJobUncheckedUpdateManyWithoutCreatedByNestedInputObjectSchema).optional(),
  webhookSubscriptions: z.lazy(() => WebhookSubscriptionUncheckedUpdateManyWithoutUserNestedInputObjectSchema).optional(),
  inquiriesSent: z.lazy(() => InquiryUncheckedUpdateManyWithoutSourceUserNestedInputObjectSchema).optional(),
  inquiriesReceived: z.lazy(() => InquiryUncheckedUpdateManyWithoutTargetUserNestedInputObjectSchema).optional()
}).strict();
export const UserUncheckedUpdateWithoutOrganizationsInputObjectSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutOrganizationsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUncheckedUpdateWithoutOrganizationsInput>;
export const UserUncheckedUpdateWithoutOrganizationsInputObjectZodSchema = makeSchema();
