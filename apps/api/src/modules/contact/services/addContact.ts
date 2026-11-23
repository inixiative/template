/**
 * @atlas
 * @kind service
 * @partOf feature:contact
 * @uses infrastructure:prisma
 */
import { db, Prisma } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { CommunicationKind, type ContactType } from '@template/db/generated/client/enums';
import { normalizeContactValue } from '#/hooks/contactRules/normalizeContactValue';
import { makeError } from '#/lib/errors';

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
  deletedAt: null,
} satisfies Prisma.ContactUncheckedUpdateInput;

const contactUniqueKey = (
  owner: ContactOwner,
  type: ContactType,
  valueKey: string,
): Prisma.ContactWhereUniqueInput => {
  if (owner.ownerModel === 'User')
    return { userId_type_valueKey: { userId: owner.userId, type, valueKey } };
  if (owner.ownerModel === 'Organization')
    return {
      organizationId_type_valueKey: { organizationId: owner.organizationId, type, valueKey },
    };
  return { spaceId_type_valueKey: { spaceId: owner.spaceId, type, valueKey } };
};

export const addContact = async <B extends ContactCreateBody>(owner: ContactOwner, body: B) => {
  const { valueKey } = normalizeContactValue(body.type, body.value);
  return db.txn(async () => {
    const [existing] = await db.withDeleted(() =>
      db.findForUpdate<Contact>(
        'Contact',
        { ...owner, type: body.type, valueKey },
        { upserting: true },
      ),
    );
    if (existing && !existing.deletedAt)
      throw makeError({ status: 409, message: 'This contact already exists' });
    return db.withDeleted(() =>
      db.contact.upsert({
        where: contactUniqueKey(owner, body.type, valueKey),
        create: { ...body, ...owner } as Prisma.ContactUncheckedCreateInput,
        update: { ...freshContact, ...body } as Prisma.ContactUncheckedUpdateInput,
      }),
    );
  });
};
