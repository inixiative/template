import { describe, expect, it } from 'bun:test';
import { type Condition, type LensNarrowing, Operator } from '@inixiative/json-rules';
import { includeFromLens } from '@template/db/lens/includeFromLens';
import { lensFor } from '@template/db/lens/lensFor';

const where = (c: Record<string, unknown>): Condition => c as unknown as Condition;

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

  describe('relations referenced by the where (hydrated so the in-memory check has its data)', () => {
    it('includes a to-many relation referenced by an aggregate where', () => {
      const lens: LensNarrowing = {
        parent: lensFor('Organization'),
        root: {
          picks: ['id'],
          where: where({
            field: 'organizationUsers',
            aggregate: { mode: 'count' },
            operator: Operator.greaterThanEquals,
            value: 1,
          }),
        },
      };
      expect(includeFromLens(lens)).toEqual({ organizationUsers: true });
    });

    it('includes a to-one relation referenced by a dotted-path where', () => {
      const lens: LensNarrowing = {
        parent: lensFor('Inquiry'),
        root: { picks: ['id'], where: where({ field: 'sourceUser.name', operator: Operator.equals, value: 'x' }) },
      };
      expect(includeFromLens(lens)).toEqual({ sourceUser: true });
    });

    it('includes a relation referenced by a field-to-field `path` comparison', () => {
      const lens: LensNarrowing = {
        parent: lensFor('Contact'),
        root: { picks: ['id'], where: where({ field: 'valueKey', operator: Operator.notEquals, path: 'user.email' }) },
      };
      expect(includeFromLens(lens)).toEqual({ user: true });
    });

    it('nests a relation referenced inside an aggregate sub-condition', () => {
      const lens: LensNarrowing = {
        parent: lensFor('Organization'),
        root: {
          picks: ['id'],
          where: where({
            field: 'organizationUsers',
            aggregate: { mode: 'count' },
            operator: Operator.greaterThanEquals,
            value: 1,
            condition: { field: 'user.id', operator: Operator.equals, value: 'x' },
          }),
        },
      };
      expect(includeFromLens(lens)).toEqual({ organizationUsers: { include: { user: true } } });
    });

    it('merges where-relations with the projection include', () => {
      const lens: LensNarrowing = {
        parent: lensFor('Organization'),
        root: {
          picks: ['spaces'],
          relations: { spaces: { picks: ['id'] } },
          where: where({
            field: 'organizationUsers',
            aggregate: { mode: 'count' },
            operator: Operator.greaterThanEquals,
            value: 1,
          }),
        },
      };
      expect(includeFromLens(lens)).toEqual({ spaces: true, organizationUsers: true });
    });

    it('adds nothing for a scalar-only where', () => {
      const lens: LensNarrowing = {
        parent: lensFor('User'),
        root: { picks: ['id'], where: where({ field: 'id', operator: Operator.equals, value: 'x' }) },
      };
      expect(includeFromLens(lens)).toBeUndefined();
    });
  });
});
