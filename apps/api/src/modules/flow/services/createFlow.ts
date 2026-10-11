/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import type { z } from 'zod';
import { includeFlowSteps } from '#/modules/flow/queries/flowIncludes';
import type { flowCreateBodySchema } from '#/modules/flow/schemas/flowSchemas';

export const createFlow = (userId: string, body: z.infer<typeof flowCreateBodySchema>) =>
  db.txn(async () => {
    const flow = await db.flow.create({ data: { userId, returnUrl: body.returnUrl } });
    await db.flowStep.createManyAndReturn({
      data: body.flowSteps.map((flowStep, order) => ({
        flowId: flow.id,
        order,
        label: flowStep.label,
        url: flowStep.url,
        data: (flowStep.data ?? {}) as Prisma.InputJsonValue,
      })),
    });

    return db.flow.findUniqueOrThrow({ where: { id: flow.id }, include: includeFlowSteps });
  });
