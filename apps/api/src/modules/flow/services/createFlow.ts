/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import type { Context } from 'hono';
import { z } from 'zod';
import { flowRegistry } from '#/modules/flow/registry/flowRegistry';
import type { flowCreateBodySchema } from '#/modules/flow/schemas/flowSchemas';
import { checkFlow } from '#/modules/flow/services/checkFlow';
import type { AppEnv } from '#/types/appEnv';

export const createFlow = async (
  c: Context<AppEnv>,
  userId: string,
  body: z.infer<typeof flowCreateBodySchema>,
) => {
  const definition = flowRegistry[body.flowKey];
  const { bindings } = z.object({ bindings: definition.bindingsSchema }).parse(body);
  const steps = await definition.steps(bindings, { userId, now: new Date() });

  const flow = await c.get('db').flow.create({
    data: {
      userId,
      flowKey: body.flowKey,
      steps: steps as Prisma.InputJsonValue,
      returnUrl: typeof bindings.returnUrl === 'string' ? bindings.returnUrl : null,
    },
  });
  return checkFlow(c, flow);
};
