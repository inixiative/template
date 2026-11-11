/**
 * @atlas
 * @kind service
 * @partOf feature:contact
 * @uses infrastructure:prisma
 */
import { db, type Prisma, revive } from '@template/db';
import type { ContactType } from '@template/db/generated/client/enums';
import { normalizeContactValue } from '#/hooks/contactRules/normalizeContactValue';

type ContactOwner =
  | { ownerModel: 'User'; userId: string }
  | { ownerModel: 'Organization'; organizationId: string }
  | { ownerModel: 'Space'; spaceId: string };

type ContactCreateBody = { type: ContactType; value: unknown };

export const reviveOrCreateContact = async <B extends ContactCreateBody>(
  owner: ContactOwner,
  body: B,
) => {
  const { valueKey } = normalizeContactValue(body.type, body.value);
  const [revived] = await revive(db.contact, { ...owner, type: body.type, valueKey });
  if (revived)
    return db.contact.update({
      where: { id: revived.id },
      data: body as Prisma.ContactUncheckedUpdateInput,
    });
  return db.contact.create({
    data: { ...body, ...owner } as Prisma.ContactUncheckedCreateInput,
  });
};
