import { describe, expect, it } from 'bun:test';
import { listBindings, projectLens } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { emailLens } from '@template/email/rules';
import { addressLens, recipientLens, registry } from '#/lib/email/registry';

describe('recipientLens', () => {
  it("targets the template's recipient lens with a bound where — the shape is the lens's, not the entry's", () => {
    const where = { field: 'id', operator: 'equals', value: 'u1' } as const;
    const lens = recipientLens(emailLens().recipient, where);
    const paths = Object.keys(projectLens(lens));
    expect(paths).toContain('User.tagAttachments.tag');
    expect(paths).toContain('User.providerRefs.segmentMembers.segment');
    expect(projectLens(lens).User?.whereClauses).toEqual([where]);
  });

  it('an address lens reaches only the email', () => {
    const lens = addressLens({ field: 'id', operator: 'equals', value: 'u1' });
    expect(lens.parent).toEqual(lensFor('User'));
    expect(lens.root?.picks).toEqual(['email']);
  });
});

describe('registry — declarative invariants', () => {
  const entityPicks = (entry: (typeof registry)[string]) =>
    (entry.entity.root as { picks: string[] }).picks;

  it('every recipient bind names a field the entity picks', () => {
    for (const entry of Object.values(registry)) {
      for (const name of listBindings(entry.recipients.where, { required: true }))
        expect(entityPicks(entry)).toContain(name);
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
