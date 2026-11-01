/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:store
 */
import { useAppStore } from '@template/ui/store';

export const myOrganizationUser = (organizationId: string) => {
  const membership = useAppStore.getState().auth.organizationUsers?.[organizationId];
  if (!membership) throw new Error(`You are not a member of organization ${organizationId}`);
  return membership;
};

export const mySpaceUser = (spaceId: string) => {
  const membership = useAppStore.getState().auth.spaceUsers?.[spaceId];
  if (!membership) throw new Error(`You are not a member of space ${spaceId}`);
  return membership;
};
