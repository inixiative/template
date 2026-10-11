/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { Context } from 'hono';
import type { z } from 'zod';
import { makeError } from '#/lib/errors';
import { flowDefinitions } from '#/modules/flow/definitions';
import type { flowCreateBodySchema } from '#/modules/flow/schemas/flowSchemas';
import { advanceSatisfiedSteps } from '#/modules/flow/services/advanceSatisfiedSteps';
import { presentFlow } from '#/modules/flow/services/presentFlow';
import type { AppEnv } from '#/types/appEnv';

export const createFlow = (
  c: Context<AppEnv>,
  userId: string,
  body: z.infer<typeof flowCreateBodySchema>,
) => {
  const parsed = flowDefinitions[body.flowKey].paramsSchema.safeParse(body.params);
  if (!parsed.success)
    throw makeError({
      status: 400,
      message: `Invalid params for flow "${body.flowKey}"`,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [`params.${issue.path.join('.')}`, [issue.message]]),
      ),
    });

  return db.txn(async () => {
    const created = await db.flow.create({
      data: { userId, flowKey: body.flowKey, params: parsed.data, returnUrl: body.returnUrl },
    });
    const { flow, progress, visibility } = await advanceSatisfiedSteps(c, created);
    if (visibility === 'refused')
      throw makeError({ status: 403, message: 'You cannot see the data this flow checks' });
    return presentFlow(flow, progress);
  });
};
