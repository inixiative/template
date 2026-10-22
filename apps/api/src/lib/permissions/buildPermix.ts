/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import { ActorModel, buildActor, type Permix } from '@template/permissions';
import { buildUserPermix } from '#/lib/permissions/buildUserPermix';
import { ownerPermix } from '#/lib/permissions/ownerPermix';
import type { PrincipalContext } from '#/lib/permissions/principalContext';

const principalPermix = ({ user, token, jwtGrant }: PrincipalContext): Promise<Permix> => {
  if (!token) return buildUserPermix(user, jwtGrant);
  return ownerPermix(token, user);
};

const actorOf = ({ user, token, jwtGrant }: PrincipalContext) => {
  if (token) return buildActor(user?.id ?? token.id, ActorModel.Token, token.integrationId);
  if (!user) return null;
  if (jwtGrant?.integrationId)
    return buildActor(user.id, ActorModel.Integration, jwtGrant.integrationId);
  return buildActor(user.id, ActorModel.User);
};

export const buildPermix = async (principal: PrincipalContext): Promise<Permix> => {
  const permix = await principalPermix(principal);
  const actor = actorOf(principal);
  if (actor) permix.setActor(actor);
  return permix;
};
