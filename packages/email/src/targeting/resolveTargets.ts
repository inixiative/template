import type { Db } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { rolesAtOrAbove } from '@template/permissions';
import type { EmailTarget, ResolvedRecipient } from '@template/email/targeting/types';

const resolveUserIds = async (db: Db, userIds: string[]): Promise<ResolvedRecipient[]> => {
  if (!userIds.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true, name: true },
  });
  return users.map((u) => ({ to: u.email, name: u.name ?? '' }));
};

const resolveOrgRole = async (db: Db, organizationId: string, role: Role): Promise<ResolvedRecipient[]> => {
  const roles = rolesAtOrAbove(role);
  const orgUsers = await db.organizationUser.findMany({
    where: { organizationId, role: { in: roles } },
    select: { user: { select: { email: true, name: true } } },
  });
  return orgUsers.map((ou) => ({ to: ou.user.email, name: ou.user.name ?? '' }));
};

const resolveSpaceRole = async (db: Db, spaceId: string, role: Role): Promise<ResolvedRecipient[]> => {
  const roles = rolesAtOrAbove(role);
  const spaceUsers = await db.spaceUser.findMany({
    where: { spaceId, role: { in: roles } },
    select: { user: { select: { email: true, name: true } } },
  });
  return spaceUsers.map((su) => ({ to: su.user.email, name: su.user.name ?? '' }));
};

const resolveOne = async (db: Db, target: EmailTarget): Promise<ResolvedRecipient[]> => {
  if ('userIds' in target) return resolveUserIds(db, target.userIds);
  if ('raw' in target) return target.raw.map((email) => ({ to: email, name: '' }));
  if ('orgRole' in target) return resolveOrgRole(db, target.orgRole.organizationId, target.orgRole.role);
  if ('spaceRole' in target) return resolveSpaceRole(db, target.spaceRole.spaceId, target.spaceRole.role);
  return [];
};

export const resolveTargets = async (db: Db, targets: EmailTarget[]): Promise<ResolvedRecipient[]> => {
  const results = await Promise.all(targets.map((t) => resolveOne(db, t)));
  const flat = results.flat();

  const seen = new Set<string>();
  return flat.filter((r) => {
    if (seen.has(r.to)) return false;
    seen.add(r.to);
    return true;
  });
};

export const resolveTargetsToAddresses = async (db: Db, targets: EmailTarget[]): Promise<string[]> => {
  const recipients = await resolveTargets(db, targets);
  return recipients.map((r) => r.to);
};
