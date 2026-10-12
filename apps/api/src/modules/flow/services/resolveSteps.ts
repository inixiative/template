/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses primitive:routeTemplates, primitive:shared
 */
import { serializeBracketQuery } from '@template/shared/bracketQuery';
import { makeError } from '#/lib/errors';
import type { FlowStepInput } from '#/modules/flow/definitions/types';
import { flowStepsSchema } from '#/modules/flow/schemas/flowSchemas';

export const resolveSteps = async (inputs: FlowStepInput[]) => {
  const { resolveOperation } = await import('#/lib/openapi/resolveOperation');
  const steps = await Promise.all(
    inputs.map(async ({ read, to, ...step }) => {
      const operation = await resolveOperation(read.operationId, read.path);
      if (operation?.method !== 'GET')
        throw makeError({
          status: 500,
          message: `Flow step "${step.key}" reads "${read.operationId}", which is not a GET route`,
        });
      const query = serializeBracketQuery(read.query ?? {}).toString();
      return {
        ...step,
        to: to ?? null,
        readPath: query ? `${operation.path}?${query}` : operation.path,
      };
    }),
  );
  return flowStepsSchema.parse(steps);
};
