import type { Contact, CustomerRef } from '@template/db/generated/client/client';
import type { CommunicationKind } from '@template/db/generated/client/enums';

const accepts = (acceptedKinds: unknown, kind: CommunicationKind): boolean => {
  if (!Array.isArray(acceptedKinds)) return false;
  return (acceptedKinds as string[]).includes(kind);
};

/**
 * Decides whether a (contact, kind) pair gets delivered.
 *
 * - `system` bypasses opt-ins entirely — always delivered (security/account).
 * - Otherwise the contact's `acceptedKinds` must include the kind.
 * - If a `customerRef` is passed (sender is acting in a customer/provider
 *   relationship), its `acceptedKinds` must also include the kind. Omit the
 *   third arg when there is no relationship.
 *
 * DB default for both `acceptedKinds` columns is `['platform']`, so a brand
 * new contact + relationship will receive `system` and `platform`. Anything
 * else (activity, marketing, fork-defined) requires explicit opt-in.
 */
export const canDeliver = (
  kind: CommunicationKind,
  contact: Pick<Contact, 'acceptedKinds'>,
  customerRef?: Pick<CustomerRef, 'acceptedKinds'> | null,
): boolean => {
  if (kind === 'system') return true;
  if (!accepts(contact.acceptedKinds, kind)) return false;
  if (!customerRef) return true;
  return accepts(customerRef.acceptedKinds, kind);
};
