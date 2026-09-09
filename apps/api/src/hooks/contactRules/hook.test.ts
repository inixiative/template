import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

// Pad to a 7-digit national number for E.164 (caller supplies a 4-digit "local" piece)
const e164 = (local: string) => `+1555${local.padStart(7, '0').slice(-7)}`;
const seqHandle = (prefix: string) => `${prefix}${getNextSeq()}`;

describe('contactRules hook — phone (per-owner unique)', () => {
  it('computes valueKey from e164 on create', async () => {
    const { entity: user } = await createUser();
    const phone = e164(String(getNextSeq()));
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: phone, country: 'US' },
      },
    });
    expect(contact.valueKey).toBe(phone);
  });

  it('rejects invalid country code (422)', async () => {
    const { entity: user } = await createUser();
    const create = async () =>
      db.contact.create({
        data: {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'ZZ' },
        },
      });
    await expect(create()).rejects.toThrow();
  });

  it('rejects malformed e164 (422)', async () => {
    const { entity: user } = await createUser();
    const create = async () =>
      db.contact.create({
        data: {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: '5551110003', country: 'US' },
        },
      });
    await expect(create()).rejects.toThrow();
  });

  it('allows the same number on two different users (per-owner uniqueness)', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const phone = e164(String(getNextSeq()));
    await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: a.id,
        type: ContactType.phone,
        value: { e164: phone, country: 'US' },
      },
    });
    const second = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: b.id,
        type: ContactType.phone,
        value: { e164: phone, country: 'US' },
      },
    });
    expect(second.valueKey).toBe(phone);
  });
});

describe('contactRules hook — email (lowercase normalization)', () => {
  it('lowercases the address into the canonical value', async () => {
    const { entity: user } = await createUser();
    const seq = getNextSeq();
    const upper = `Mixed.Case${seq}@Example.COM`;
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.email,
        value: { address: upper },
      },
    });
    expect(contact.value).toEqual({ address: upper.toLowerCase() });
    expect(contact.valueKey).toBe(upper.toLowerCase());
  });
});

describe('contactRules hook — linkedin (URL normalization, per-owner uniqueness)', () => {
  it('normalizes a pasted URL into {classifier, handle}', async () => {
    const { entity: user } = await createUser();
    const handle = seqHandle('sample');
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.linkedin,
        value: { url: `https://www.linkedin.com/in/${handle}?trk=ref` },
      },
    });
    expect(contact.value).toEqual({ classifier: 'personal', handle });
    expect(contact.valueKey).toBe(`personal:${handle.toLowerCase()}`);
  });

  it('allows two different users to register the same linkedin handle (per-owner)', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const handle = seqHandle('shared');
    await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: a.id,
        type: ContactType.linkedin,
        value: { classifier: 'personal', handle },
      },
    });
    const second = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: b.id,
        type: ContactType.linkedin,
        value: { classifier: 'personal', handle: handle.toUpperCase() },
      },
    });
    expect(second.valueKey).toBe(`personal:${handle.toLowerCase()}`);
  });
});

describe('contactRules hook — subtype enforcement', () => {
  it('rejects subtype on linkedin (forbidden)', async () => {
    const { entity: user } = await createUser();
    const create = async () =>
      db.contact.create({
        data: {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.linkedin,
          subtype: 'personal',
          value: { classifier: 'personal', handle: seqHandle('sub') },
        },
      });
    await expect(create()).rejects.toThrow();
  });

  it('accepts known phone subtype', async () => {
    const { entity: user } = await createUser();
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        subtype: 'mobile',
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(contact.subtype).toBe('mobile');
  });

  it('rejects unknown phone subtype', async () => {
    const { entity: user } = await createUser();
    const create = async () =>
      db.contact.create({
        data: {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          subtype: 'pager',
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
      });
    await expect(create()).rejects.toThrow();
  });
});

describe('contactRules hook — position auto-assign', () => {
  it('appends MAX+1 per (owner, type) when position omitted', async () => {
    const { entity: user } = await createUser();
    const first = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(first.position).toBe(1);

    const second = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(second.position).toBe(2);
  });

  it('clamps explicit position above MAX+1 on single create', async () => {
    const { entity: user } = await createUser();
    const first = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        position: 42,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(first.position).toBe(1);

    const second = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        position: 99,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(second.position).toBe(2);
  });

  it('honors explicit in-range position on single create and shifts siblings up', async () => {
    const { entity: user } = await createUser();
    const a = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    const b = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    const c = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        position: 1,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(c.position).toBe(1);
    const aAfter = await db.contact.findUniqueOrThrow({ where: { id: a.id } });
    const bAfter = await db.contact.findUniqueOrThrow({ where: { id: b.id } });
    expect(aAfter.position).toBe(2);
    expect(bAfter.position).toBe(3);
  });

  it('clamps explicit position above MAX+1 on upsert.create', async () => {
    const { entity: user } = await createUser();
    const fakeId = Bun.randomUUIDv7();
    const upserted = await db.contact.upsert({
      where: { id: fakeId },
      create: {
        id: fakeId,
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        position: 42,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
      update: {},
    });
    expect(upserted.position).toBe(1);
  });

  it('createManyAndReturn appends no-position rows in input order around explicit positions', async () => {
    const { entity: user } = await createUser();
    const rows = await db.contact.createManyAndReturn({
      data: [
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          position: 1,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
      ],
    });
    expect(rows[0]!.position).toBe(2);
    expect(rows[1]!.position).toBe(1);
    expect(rows[2]!.position).toBe(3);
  });

  it('createManyAndReturn clamps out-of-bound explicit positions to the running tail', async () => {
    const { entity: user } = await createUser();
    const rows = await db.contact.createManyAndReturn({
      data: [
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          position: 99,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          position: 50,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
      ],
    });
    expect(rows[0]!.position).toBe(1);
    expect(rows[1]!.position).toBe(2);
  });

  it('scopes ordering by (owner, type) — different types start fresh', async () => {
    const { entity: user } = await createUser();
    const phone = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    const email = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.email,
        value: { address: `sort${getNextSeq()}@example.com` },
      },
    });
    expect(phone.position).toBeGreaterThan(0);
    expect(email.position).toBe(1); // first email for this user — not 2
  });
});
