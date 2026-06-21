/**
 * @atlas
 * @kind utils
 * @partOf primitive:messaging
 * @uses none
 */

export type ScopedEntity = Record<string, unknown>;

// @wip — gate ① scope: pass-through stub. Real rebac read-access resolution (recipient ∈
// scope(entity), ideally the distal-user set as a query) is COMM-005. Returns true for everyone.
export const inScope = async (_recipientUserId: string, _entity: ScopedEntity): Promise<boolean> => true;
