/**
 * @atlas
 * @kind type, helper
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { Actor, ActorCheck } from '@inixiative/permissions';

export const ActorModel = {
  User: 'User',
  Token: 'Token',
  Integration: 'Integration',
  Grant: 'Grant',
} as const;
export type ActorModel = (typeof ActorModel)[keyof typeof ActorModel];

export type TemplateActor = Actor & {
  model: ActorModel;
  integrationId: string | null;
};

export const buildActor = (
  id: string,
  model: ActorModel,
  integrationId: string | null = null,
): TemplateActor => ({ id, model, integrationId });

export const inPerson: ActorCheck = {
  actor: { field: 'model', operator: Operator.equals, value: ActorModel.User },
};

export const actorBindNames: ReadonlySet<string> = new Set(
  Object.keys(buildActor('', ActorModel.User)).map((field) => `actor.${field}`),
);
