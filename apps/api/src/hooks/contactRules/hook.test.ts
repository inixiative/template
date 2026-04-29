import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

registerRulesHook();
registerContactRulesHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
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

describe('contactRules hook — linkedin (URL normalization, global uniqueness)', () => {
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

  it('rejects two users claiming the same linkedin handle (409)', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const handle = seqHandle('unique');
    await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: a.id,
        type: ContactType.linkedin,
        value: { classifier: 'personal', handle },
      },
    });
    const create = async () =>
      db.contact.create({
        data: {
          ownerModel: ContactOwnerModel.User,
          userId: b.id,
          type: ContactType.linkedin,
          value: { classifier: 'personal', handle: handle.toUpperCase() }, // case-insensitive collision
        },
      });
    await expect(create()).rejects.toThrow();
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

describe('contactRules hook — sortOrder auto-assignment', () => {
  it('assigns sortOrder=1 to the first contact of a type for an owner', async () => {
    const { entity: user } = await createUser();
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(contact.sortOrder).toBe(1);
  });

  it('increments sortOrder for subsequent contacts of the same type', async () => {
    const { entity: user } = await createUser();
    const base = { ownerModel: ContactOwnerModel.User, userId: user.id, type: ContactType.phone };
    const first = await db.contact.create({ data: { ...base, value: { e164: e164(String(getNextSeq())), country: 'US' } } });
    const second = await db.contact.create({ data: { ...base, value: { e164: e164(String(getNextSeq())), country: 'US' } } });
    const third = await db.contact.create({ data: { ...base, value: { e164: e164(String(getNextSeq())), country: 'US' } } });
    expect(first.sortOrder).toBe(1);
    expect(second.sortOrder).toBe(2);
    expect(third.sortOrder).toBe(3);
  });

  it('sortOrder sequences are independent per type', async () => {
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
        value: { address: `seq${getNextSeq()}@example.com` },
      },
    });
    expect(phone.sortOrder).toBe(1);
    expect(email.sortOrder).toBe(1);
  });

  it('respects an explicit sortOrder when provided', async () => {
    const { entity: user } = await createUser();
    const contact = await db.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        sortOrder: 10,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
    });
    expect(contact.sortOrder).toBe(10);
  });
});
