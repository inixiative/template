import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { CronJobCreateWithoutCreatedByInputObjectSchema as CronJobCreateWithoutCreatedByInputObjectSchema } from './CronJobCreateWithoutCreatedByInput.schema';
import { CronJobUncheckedCreateWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateWithoutCreatedByInput.schema';
import { CronJobCreateOrConnectWithoutCreatedByInputObjectSchema as CronJobCreateOrConnectWithoutCreatedByInputObjectSchema } from './CronJobCreateOrConnectWithoutCreatedByInput.schema';
import { CronJobCreateManyCreatedByInputEnvelopeObjectSchema as CronJobCreateManyCreatedByInputEnvelopeObjectSchema } from './CronJobCreateManyCreatedByInputEnvelope.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './CronJobWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema).array(), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => CronJobCreateOrConnectWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobCreateOrConnectWithoutCreatedByInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => CronJobCreateManyCreatedByInputEnvelopeObjectSchema).optional(),
  connect: z.union([z.lazy(() => CronJobWhereUniqueInputObjectSchema), z.lazy(() => CronJobWhereUniqueInputObjectSchema).array()]).optional()
}).strict();
export const CronJobCreateNestedManyWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobCreateNestedManyWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCreateNestedManyWithoutCreatedByInput>;
export const CronJobCreateNestedManyWithoutCreatedByInputObjectZodSchema = makeSchema();
