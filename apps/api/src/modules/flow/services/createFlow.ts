/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma, primitive:errors
 */
import type { Prisma } from '@template/db';
import { log } from '@template/shared/logger';
import type { Context } from 'hono';
import type { z } from 'zod';
import { makeError } from '#/lib/errors';
import { flowDefinitions } from '#/modules/flow/definitions';
import type { flowCreateBodySchema } from '#/modules/flow/schemas/flowSchemas';
import { checkSteps } from '#/modules/flow/services/checkSteps';
import { resolveSteps } from '#/modules/flow/services/resolveSteps';
import type { AppEnv } from '#/types/appEnv';

export const createFlow = async (
  c: Context<AppEnv>,
  userId: string,
  { flowKey, bindings }: z.infer<typeof flowCreateBodySchema>,
) => {
  const definition = flowDefinitions[flowKey];
  const parsed = definition.bindingsSchema.safeParse(bindings);
  if (!parsed.success)
    throw makeError({
      status: 400,
      message: `Invalid bindings for flow "${flowKey}"`,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [`bindings.${issue.path.join('.')}`, [issue.message]]),
      ),
    });

  const steps = await resolveSteps(definition.steps(parsed.data, new Date()));
  const checked = await checkSteps(c, steps).catch((error: unknown) => {
    log.warn(`flow "${flowKey}" could not check its steps: ${String(error)}`);
    throw makeError({ status: 400, message: `Flow "${flowKey}" cannot check its steps for you` });
  });

  const { returnUrl } = parsed.data;
  const db = c.get('db');
  const flow = await db.flow.create({
    data: {
      userId,
      flowKey,
      steps: steps as Prisma.InputJsonValue,
      returnUrl: typeof returnUrl === 'string' ? returnUrl : null,
    },
  });
  if (checked.currentStep === steps.length) await db.flow.deleteMany({ where: { id: flow.id } });
  return { ...flow, steps, ...checked };
};
