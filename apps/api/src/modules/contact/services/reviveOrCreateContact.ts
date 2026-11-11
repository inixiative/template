/**
 * @atlas
 * @kind service
 * @partOf feature:contact
 * @uses infrastructure:prisma
 */
import { db, Prisma, revive } from '@template/db';
import { CommunicationKind, type ContactType } from '@template/db/generated/client/enums';
import { normalizeContactValue } from '#/hooks/contactRules/normalizeContactValue';

type ContactOwner =
  | { ownerModel: 'User'; userId: string }
  | { ownerModel: 'Organization'; organizationId: string }
  | { ownerModel: 'Space'; spaceId: string };

type ContactCreateBody = { type: ContactType; value: unknown };

// why: a revived contact starts fresh; verification, overrides and opt-ins never carry over.
const freshContact = {
  subtype: null,
  label: null,
  permissionRules: Prisma.DbNull,
  verifiedAt: null,
  source: null,
  deliverability: null,
  deliverabilityCheckedAt: null,
  acceptedKinds: [CommunicationKind.platform, CommunicationKind.activity],
} satisfies Prisma.ContactUncheckedUpdateInput;

export const reviveOrCreateContact = async <B extends ContactCreateBody>(
  owner: ContactOwner,
  body: B,
) => {
  const { valueKey } = normalizeContactValue(body.type, body.value);
  return db.txn(async () => {
    const [revived] = await revive(db.contact, { ...owner, type: body.type, valueKey });
    if (revived)
      return db.contact.update({
        where: { id: revived.id },
        data: { ...freshContact, ...body } as Prisma.ContactUncheckedUpdateInput,
      });
    return db.contact.create({
      data: { ...body, ...owner } as Prisma.ContactUncheckedCreateInput,
    });
  });
};
