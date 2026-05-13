import { afterEach } from 'bun:test';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, getNextSeq, registerTestTracker } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

// registerDbHook dedupes by hook name, so module-level registration across
// multiple test files (which Bun runs in parallel) is safe — second-and-later
// imports are no-ops. We intentionally do NOT call clearHookRegistry() in
// afterAll because parallel files share the registry; one file clearing it
// would yank hooks out from under tests still running in sibling files.
registerTestTracker();
registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();

afterEach(async () => {
  await cleanupTouchedTables(db);
});

export const e164 = () => `+1555${String(getNextSeq()).padStart(7, '0').slice(-7)}`;

export const phone = (userId: string, position?: number) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.phone,
      value: { e164: e164(), country: 'US' },
      ...(position !== undefined ? { position } : {}),
    },
  });

export const phoneRow = (userId: string, position?: number) => ({
  ownerModel: ContactOwnerModel.User as const,
  userId,
  type: ContactType.phone as const,
  value: { e164: e164(), country: 'US' },
  ...(position !== undefined ? { position } : {}),
});

export const email = (userId: string) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.email,
      value: { address: `test${getNextSeq()}@example.com` },
    },
  });

export const mkEmail = (userId: string) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.email,
      value: { address: `t${getNextSeq()}@ex.com` },
    },
  });

export const liveOrders = (userId: string, type = ContactType.phone) =>
  db.contact.findMany({
    where: { userId, type, deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

export const allOrders = (userId: string, type = ContactType.phone) =>
  db.contact.findMany({
    where: { userId, type },
    orderBy: { position: 'asc' },
    select: { id: true, position: true, deletedAt: true },
  });

export const positions = (rows: { position: number }[]) => rows.map((r) => r.position);

export const posOf = (rows: { id: string; position: number }[], id: string) =>
  rows.find((r) => r.id === id)?.position;

export const scope = (userId: string) => ({
  ownerModel: ContactOwnerModel.User,
  userId,
  type: ContactType.phone,
});

export const softDelete = (id: string) =>
  db.contact.update({ where: { id }, data: { deletedAt: new Date() } });

export const restore = (id: string) =>
  db.contact.update({ where: { id }, data: { deletedAt: null } });
