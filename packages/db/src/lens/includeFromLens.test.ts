import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { includeFromLens } from '@template/db/lens/includeFromLens';
import { lensFor } from '@template/db/lens/lensFor';

describe('includeFromLens', () => {
  it('includes a single (to-one) and a many (to-list) relation', () => {
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: {
        picks: ['sourceUser', 'auditLogsAsSubject'],
        relations: {
          sourceUser: { picks: ['id'] },
          auditLogsAsSubject: { picks: ['id'] },
        },
      },
    };

    expect(includeFromLens(lens)).toEqual({ sourceUser: true, auditLogsAsSubject: true });
  });

  it('a narrowed lens reduces the relation tree', () => {
    // Inquiry has sourceUser, targetUser, sourceOrganization, auditLogsAsSubject, … — narrow to a
    // single relation, and reduce that relation's own subtree to one nested relation.
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: {
        picks: ['sourceUser'],
        relations: {
          sourceUser: { picks: ['contacts'], relations: { contacts: { picks: ['id'] } } },
        },
      },
    };

    expect(includeFromLens(lens)).toEqual({ sourceUser: { include: { contacts: true } } });
  });

  it('omit removes a relation that would otherwise be exposed', () => {
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: {
        picks: ['sourceUser', 'targetUser'],
        omits: ['sourceUser'],
        relations: { sourceUser: { picks: ['id'] }, targetUser: { picks: ['id'] } },
      },
    };
    expect(includeFromLens(lens)).toEqual({ targetUser: true });
  });

  it('respects omit without picks and does not re-expose via off-path cycles', () => {
    const lens: LensNarrowing = { parent: lensFor('Inquiry'), root: { omits: ['sourceUser'] } };
    const include = includeFromLens(lens) as Record<string, unknown>;
    expect(include).not.toHaveProperty('sourceUser');
    expect(include).toHaveProperty('targetUser');
  });

  it('returns undefined when no relations are exposed', () => {
    const lens: LensNarrowing = { parent: lensFor('Inquiry'), root: { picks: ['id'] } };
    expect(includeFromLens(lens)).toBeUndefined();
  });
});
