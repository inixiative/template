/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz
 * @uses none
 */
import type { TransitionMap } from '@inixiative/transitions';
import { integrationResourceTransitions } from '@template/permissions/transitions/integrationResourceTransitions';
import { memberRoleTransitions } from '@template/permissions/transitions/memberRoleTransitions';

export const transitions: TransitionMap = {
  'db:integrationResource': integrationResourceTransitions,
  'db:organizationUser': memberRoleTransitions('organization'),
  'db:spaceUser': memberRoleTransitions('space'),
};
