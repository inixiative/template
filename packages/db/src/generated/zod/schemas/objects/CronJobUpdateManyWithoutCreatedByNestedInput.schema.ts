import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { CronJobCreateWithoutCreatedByInputObjectSchema as CronJobCreateWithoutCreatedByInputObjectSchema } from './CronJobCreateWithoutCreatedByInput.schema';
import { CronJobUncheckedCreateWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateWithoutCreatedByInput.schema';
import { CronJobCreateOrConnectWithoutCreatedByInputObjectSchema as CronJobCreateOrConnectWithoutCreatedByInputObjectSchema } from './CronJobCreateOrConnectWithoutCreatedByInput.schema';
import { CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectSchema as CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectSchema } from './CronJobUpsertWithWhereUniqueWithoutCreatedByInput.schema';
import { CronJobCreateManyCreatedByInputEnvelopeObjectSchema as CronJobCreateManyCreatedByInputEnvelopeObjectSchema } from './CronJobCreateManyCreatedByInputEnvelope.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './CronJobWhereUniqueInput.schema';
import { CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectSchema as CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectSchema } from './CronJobUpdateWithWhereUniqueWithoutCreatedByInput.schema';
import { CronJobUpdateManyWithWhereWithoutCreatedByInputObjectSchema as CronJobUpdateManyWithWhereWithoutCreatedByInputObjectSchema } from './CronJobUpdateManyWithWhereWithoutCreatedByInput.schema';
import { CronJobScalarWhereInputObjectSchema as CronJobScalarWhereInputObjectSchema } from './CronJobScalarWhereInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema).array(), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema).array()]).optional(),
  connectOrCreate: z.union([z.lazy(() => CronJobCreateOrConnectWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobCreateOrConnectWithoutCreatedByInputObjectSchema).array()]).optional(),
  upsert: z.union([z.lazy(() => CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectSchema).array()]).optional(),
  createMany: z.lazy(() => CronJobCreateManyCreatedByInputEnvelopeObjectSchema).optional(),
  set: z.union([z.lazy(() => CronJobWhereUniqueInputObjectSchema), z.lazy(() => CronJobWhereUniqueInputObjectSchema).array()]).optional(),
  disconnect: z.union([z.lazy(() => CronJobWhereUniqueInputObjectSchema), z.lazy(() => CronJobWhereUniqueInputObjectSchema).array()]).optional(),
  delete: z.union([z.lazy(() => CronJobWhereUniqueInputObjectSchema), z.lazy(() => CronJobWhereUniqueInputObjectSchema).array()]).optional(),
  connect: z.union([z.lazy(() => CronJobWhereUniqueInputObjectSchema), z.lazy(() => CronJobWhereUniqueInputObjectSchema).array()]).optional(),
  update: z.union([z.lazy(() => CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectSchema).array()]).optional(),
  updateMany: z.union([z.lazy(() => CronJobUpdateManyWithWhereWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUpdateManyWithWhereWithoutCreatedByInputObjectSchema).array()]).optional(),
  deleteMany: z.union([z.lazy(() => CronJobScalarWhereInputObjectSchema), z.lazy(() => CronJobScalarWhereInputObjectSchema).array()]).optional()
}).strict();
export const CronJobUpdateManyWithoutCreatedByNestedInputObjectSchema: z.ZodType<Prisma.CronJobUpdateManyWithoutCreatedByNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobUpdateManyWithoutCreatedByNestedInput>;
export const CronJobUpdateManyWithoutCreatedByNestedInputObjectZodSchema = makeSchema();
