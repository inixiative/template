/**
 * @atlas
 * @kind utils
 * @partOf primitive:messaging
 * @uses infrastructure:prisma
 */
import type { Contact, CustomerRef } from '@template/db/generated/client/client';
import type { CommunicationKind } from '@template/db/generated/client/enums';

export const canDeliver = (
  kind: CommunicationKind,
  contact: Pick<Contact, 'acceptedKinds'>,
  customerRef?: Pick<CustomerRef, 'acceptedKinds'> | null,
): boolean => {
  if (kind === 'system') return true;
  if (!contact.acceptedKinds.includes(kind)) return false;
  if (!customerRef) return true;
  return customerRef.acceptedKinds.includes(kind);
};
