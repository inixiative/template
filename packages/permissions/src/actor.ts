/**
 * @atlas
 * @kind type, helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Actor } from '@inixiative/permissions';
import { IntegrationReach } from '@template/db/generated/client/enums';

export const ActorModel = { User: 'User', Token: 'Token', Inquiry: 'Inquiry' } as const;
export type ActorModel = (typeof ActorModel)[keyof typeof ActorModel];

export type IntegrationBinding = {
  integrationId: string | null;
  integrationReach: IntegrationReach;
  integrationReachIds: string[];
};

// why: a rule binding a field the actor lacks throws, so every actor carries every field
export type TemplateActor = Actor & {
  model: ActorModel;
  integrationId: string | null;
  integrationReach: 'all' | 'listed';
  integrationIds: string[];
};

export const defaultIntegrationReach = (integrationId: string | null): IntegrationReach =>
  integrationId ? IntegrationReach.none : IntegrationReach.all;

const reachOf = ({
  integrationId,
  integrationReach,
  integrationReachIds,
}: IntegrationBinding): Pick<TemplateActor, 'integrationReach' | 'integrationIds'> => {
  if (integrationReach === IntegrationReach.all)
    return { integrationReach: 'all', integrationIds: [] };
  if (integrationReach === IntegrationReach.own)
    return { integrationReach: 'listed', integrationIds: integrationId ? [integrationId] : [] };
  if (integrationReach === IntegrationReach.listed)
    return { integrationReach: 'listed', integrationIds: [...integrationReachIds] };
  return { integrationReach: 'listed', integrationIds: [] };
};

export const buildActor = (
  id: string,
  model: ActorModel,
  binding: IntegrationBinding | null,
): TemplateActor => ({
  id,
  model,
  integrationId: binding?.integrationId ?? null,
  ...(binding ? reachOf(binding) : { integrationReach: 'all', integrationIds: [] }),
});
