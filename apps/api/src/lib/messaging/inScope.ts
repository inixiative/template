/**
 * @atlas
 * @kind utils
 * @partOf primitive:messaging
 * @uses none
 */

export type ScopedEntity = Record<string, unknown>;

// STUB (pass-through). Real rebac read-access check deferred to COMM-005.
export const inScope = async (_recipientUserId: string, _entity: ScopedEntity): Promise<boolean> => true;
