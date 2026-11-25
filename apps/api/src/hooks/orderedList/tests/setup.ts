import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { createContact, nextFactorySequenceNumber } from '@template/db/test';

export const e164 = () => `+1555${String(nextFactorySequenceNumber()).padStart(7, '0').slice(-7)}`;

export const phoneContactData = (userId: string, position?: number) => ({
  ownerModel: ContactOwnerModel.User,
  userId,
  type: ContactType.phone,
  value: { e164: e164(), country: 'US' },
  ...(position !== undefined ? { position } : {}),
});

export const createPhoneContact = async (userId: string, position?: number) =>
  (await createContact(phoneContactData(userId, position))).entity;

export const createEmailContact = async (userId: string) =>
  (
    await createContact({
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.email,
      value: { address: `test${nextFactorySequenceNumber()}@example.com` },
    })
  ).entity;

export const fetchNotDeletedContactPositions = (
  userId: string,
  type: ContactType = ContactType.phone,
) =>
  db.contact.findMany({
    where: { userId, type, deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

export const fetchContactPositionsIncludingDeleted = (userId: string, type = ContactType.phone) =>
  db.withDeleted(() =>
    db.contact.findMany({
      where: { userId, type },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, deletedAt: true },
    }),
  );

export const positions = (rows: { position: number }[]) => rows.map((r) => r.position);

export const positionOfContact = (rows: { id: string; position: number }[], id: string) =>
  rows.find((r) => r.id === id)?.position;

export const softDeleteContact = (id: string) =>
  db.contact.update({ where: { id }, data: { deletedAt: new Date() } });

export const restoreContact = (id: string) =>
  db.withDeleted(() => db.contact.update({ where: { id }, data: { deletedAt: null } }));
