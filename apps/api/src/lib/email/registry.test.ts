import { describe, expect, it } from 'bun:test';
import { requiredBindings } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { type RecipientSpec, recipientLens, registry } from '#/lib/email/registry';

describe('recipientLens', () => {
  it('assembles a User-rooted narrowing from the static surface and a bound where', () => {
    const spec: RecipientSpec = {
      picks: ['id', 'name', 'email'],
      relations: { organizationUser: { picks: ['role'] } },
      where: { field: 'id', operator: 'equals', bind: 'id' },
    };
    const where = { field: 'id', operator: 'equals', value: 'u1' } as const;

    const lens = recipientLens(spec, where);

    expect(lens.parent).toEqual(lensFor('User'));
    expect(lens.root.picks).toEqual(['id', 'name', 'email']);
    expect(lens.root.relations).toEqual({ organizationUser: { picks: ['role'] } });
    expect(lens.root.where).toEqual(where);
  });

  it('omits relations when the spec declares none', () => {
    const spec: RecipientSpec = {
      picks: ['id', 'name', 'email'],
      where: { field: 'id', operator: 'equals', bind: 'id' },
    };
    const lens = recipientLens(spec, { field: 'id', operator: 'equals', value: 'u1' });
    expect('relations' in lens.root).toBe(false);
  });
});

describe('registry — declarative invariants', () => {
  const entityPicks = (entry: (typeof registry)[string]) => (entry.entity.root as { picks: string[] }).picks;

  it('every entry declares the delivery leaf in its static recipient surface', () => {
    for (const entry of Object.values(registry)) {
      for (const leaf of ['id', 'name', 'email']) expect(entry.recipients.picks).toContain(leaf);
    }
  });

  it('every recipient bind names a field the entity picks', () => {
    for (const entry of Object.values(registry)) {
      for (const name of requiredBindings(entry.recipients.where)) expect(entityPicks(entry)).toContain(name);
    }
  });

  it('every sender id names a field the entity picks', () => {
    for (const entry of Object.values(registry)) {
      for (const [key, field] of Object.entries(entry.sender)) {
        if (key !== 'type') expect(entityPicks(entry)).toContain(field);
      }
    }
  });

  it('entries are plain serializable data (no functions)', () => {
    for (const entry of Object.values(registry)) {
      expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
    }
  });
});
