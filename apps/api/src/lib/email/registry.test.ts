import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens';
import { type RecipientDefinition, recipientLens, registry } from '#/lib/email/registry';

describe('recipientLens', () => {
  it('assembles a User-rooted narrowing from the static surface and the dynamic where', () => {
    const definition: RecipientDefinition = {
      picks: ['id', 'name', 'email'],
      relations: { organizationUser: { picks: ['role'] } },
      where: (entity, sender) => ({
        all: [
          { field: 'organizationUser.organizationId', operator: 'equals', value: (entity as { orgId: string }).orgId },
          { field: 'id', operator: 'notEquals', value: sender.type },
        ],
      }) as never,
    };

    const lens = recipientLens(definition, { orgId: 'org-1' }, { type: 'platform' });

    expect(lens.parent).toEqual(lensFor('User'));
    expect(lens.root.picks).toEqual(['id', 'name', 'email']);
    expect(lens.root.relations).toEqual({ organizationUser: { picks: ['role'] } });
    expect(lens.root.where).toEqual({
      all: [
        { field: 'organizationUser.organizationId', operator: 'equals', value: 'org-1' },
        { field: 'id', operator: 'notEquals', value: 'platform' },
      ],
    } as never);
  });

  it('omits relations when the definition declares none', () => {
    const definition: RecipientDefinition = {
      picks: ['id', 'name', 'email'],
      where: () => ({ field: 'id', operator: 'equals', value: 'u1' }) as never,
    };

    const lens = recipientLens(definition, {}, { type: 'platform' });
    expect('relations' in lens.root).toBe(false);
  });

  it('every registry entry declares the delivery leaf in its static surface', () => {
    for (const entry of Object.values(registry)) {
      for (const leaf of ['id', 'name', 'email']) expect(entry.recipients.picks).toContain(leaf);
    }
  });

  it('the welcome entry resolves its recipient from the entity', () => {
    const lens = recipientLens(registry.welcome.recipients, { id: 'u42' }, { type: 'platform' });
    expect(lens.root.where).toEqual({ field: 'id', operator: 'equals', value: 'u42' } as never);
  });
});
