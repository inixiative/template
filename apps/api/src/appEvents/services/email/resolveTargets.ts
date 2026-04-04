import { db } from '@template/db';
import { rolesAtOrAbove } from '@template/permissions';
import type { EmailTarget, ResolvedRecipient } from '#/appEvents/types';

const resolveUserIds = async (userIds: string[]): Promise<ResolvedRecipient[]> => {
  if (!userIds.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true, name: true },
  });
  return users
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({ to: u.email, name: u.name ?? '' }));
};

const resolveOrgRole = async (organizationId: string, role: string): Promise<ResolvedRecipient[]> => {
  const roles = rolesAtOrAbove(role);
  const orgUsers = await db.organizationUser.findMany({
    where: { organizationId, role: { in: roles as never } },
    select: { user: { select: { email: true, name: true } } },
  });
  return orgUsers
    .filter((ou): ou is typeof ou & { user: { email: string } } => !!ou.user.email)
    .map((ou) => ({ to: ou.user.email, name: ou.user.name ?? '' }));
};

const resolveSpaceRole = async (spaceId: string, role: string): Promise<ResolvedRecipient[]> => {
  const roles = rolesAtOrAbove(role);
  const spaceUsers = await db.spaceUser.findMany({
    where: { spaceId, role: { in: roles as never } },
    select: { user: { select: { email: true, name: true } } },
  });
  return spaceUsers
    .filter((su): su is typeof su & { user: { email: string } } => !!su.user.email)
    .map((su) => ({ to: su.user.email, name: su.user.name ?? '' }));
};

const resolveOne = async (target: EmailTarget): Promise<ResolvedRecipient[]> => {
  if ('userIds' in target) return resolveUserIds(target.userIds);
  if ('raw' in target) return target.raw.map((email) => ({ to: email, name: '' }));
  if ('orgRole' in target) return resolveOrgRole(target.orgRole.organizationId, target.orgRole.role);
  if ('spaceRole' in target) return resolveSpaceRole(target.spaceRole.spaceId, target.spaceRole.role);
  return [];
};

export const resolveTargets = async (targets: EmailTarget | EmailTarget[]): Promise<ResolvedRecipient[]> => {
  const list = Array.isArray(targets) ? targets : [targets];
  const results = await Promise.all(list.map(resolveOne));
  const flat = results.flat();

  const seen = new Set<string>();
  return flat.filter((r) => {
    if (seen.has(r.to)) return false;
    seen.add(r.to);
    return true;
  });
};

export const resolveTargetsToAddresses = async (targets: EmailTarget | EmailTarget[]): Promise<string[]> => {
  const recipients = await resolveTargets(targets);
  return recipients.map((r) => r.to);
};
