/**
 * @atlas
 * @kind utils
 * @partOf primitive:messaging
 * @uses infrastructure:prisma
 */
import type { Contact, CustomerRelationship } from '@template/db/generated/client/client';
import type { CommunicationKind } from '@template/db/generated/client/enums';

export const canDeliver = (
  kind: CommunicationKind,
  contact: Pick<Contact, 'acceptedKinds'>,
  customerRelationship?: Pick<CustomerRelationship, 'acceptedKinds'> | null,
): boolean => {
  if (kind === 'system') return true;
  if (!contact.acceptedKinds.includes(kind)) return false;
  if (!customerRelationship) return true;
  return customerRelationship.acceptedKinds.includes(kind);
};
