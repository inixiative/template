/**
 * @atlas
 * @kind utils
 * @partOf primitive:messaging
 * @uses none
 */

export type TargetableEntity = Record<string, unknown>;

// Gate ① of delivery — rebac targeting. Whether `recipientUserId` may be targeted for a
// communication concerning `entity`: the read-access check that drops recipients who can't see it.
// Resolution shape it stands in for: target (org/space/user) → permission → relations → users.
// STUB (pass-through). The real check builds a per-actor permix (createPermissions + setUserId +
// setup{User,Org,Space}Permissions) and runs check(permix, rebacSchema, type, entity, 'read') —
// blocked on making that permission setup context-free for the job worker (no request context).
export const canTarget = async (_recipientUserId: string, _entity: TargetableEntity): Promise<boolean> => true;
