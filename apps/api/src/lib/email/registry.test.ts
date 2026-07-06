import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens';
import { type RecipientSpec, recipientLens, registry } from '#/lib/email/registry';

describe('recipientLens', () => {
  it('assembles a User-rooted narrowing from the static surface and a resolved where', () => {
    const spec: RecipientSpec = {
      picks: ['id', 'name', 'email'],
      relations: { organizationUser: { picks: ['role'] } },
      where: { field: 'id', operator: 'equals', bind: 'recipientId' } as never,
      bindings: { recipientId: 'entity.id' },
    };
    const where = { field: 'id', operator: 'equals', value: 'u1' } as never;

    const lens = recipientLens(spec, where);

    expect(lens.parent).toEqual(lensFor('User'));
    expect(lens.root.picks).toEqual(['id', 'name', 'email']);
    expect(lens.root.relations).toEqual({ organizationUser: { picks: ['role'] } });
    expect(lens.root.where).toEqual(where);
  });

  it('omits relations when the spec declares none', () => {
    const spec: RecipientSpec = {
      picks: ['id', 'name', 'email'],
      where: { field: 'id', operator: 'equals', bind: 'recipientId' } as never,
      bindings: { recipientId: 'entity.id' },
    };
    const lens = recipientLens(spec, { field: 'id', operator: 'equals', value: 'u1' } as never);
    expect('relations' in lens.root).toBe(false);
  });
});

describe('registry — declarative invariants', () => {
  it('every entry declares the delivery leaf in its static recipient surface', () => {
    for (const entry of Object.values(registry)) {
      for (const leaf of ['id', 'name', 'email']) expect(entry.recipients.picks).toContain(leaf);
    }
  });

  it('every recipient bind name used in the where is declared in bindings', () => {
    for (const entry of Object.values(registry)) {
      const where = JSON.stringify(entry.recipients.where);
      for (const [, bind] of [...where.matchAll(/"bind":"([^"]+)"/g)]) {
        expect(entry.recipients.bindings).toHaveProperty(bind);
      }
    }
  });

  it('entries are plain serializable data (no functions)', () => {
    for (const entry of Object.values(registry)) {
      expect(typeof entry.sender).toBe('object');
      expect(JSON.parse(JSON.stringify(entry.recipients))).toEqual(entry.recipients);
    }
  });
});
