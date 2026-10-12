/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/db/generated/client/client';
import { flowStepsSchema } from '#/modules/flow/schemas/flowSchemas';

export const parseFlow = (flow: Flow) => ({ ...flow, steps: flowStepsSchema.parse(flow.steps) });
