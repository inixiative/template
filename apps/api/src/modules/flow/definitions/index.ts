/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowKey } from '@template/db/generated/client/enums';
import { setUpOrganizationFlow } from '#/modules/flow/definitions/setUpOrganization';
import type { FlowDefinition } from '#/modules/flow/definitions/types';

export const flowDefinitions: Record<FlowKey, FlowDefinition> = {
  setUpOrganization: setUpOrganizationFlow,
};
