import { describe, expect, it } from 'bun:test';
import { Prisma } from '@template/db';
import { lensFor } from '@template/db/lens';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';

describe('buildWhereClause', () => {
  describe('global search (single term, fan-out across fields)', () => {
    it('emits a case-insensitive OR across String fields', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name', 'email'] },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { email: { contains: 'aron', mode: 'insensitive' } },
              { name: { contains: 'aron', mode: 'insensitive' } },
            ],
          },
        ],
      });
    });

    it('walks relation paths', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('Inquiry'),
          root: { picks: [], relations: { sourceUser: { picks: ['name', 'email'] } } },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { sourceUser: { email: { contains: 'aron', mode: 'insensitive' } } },
              { sourceUser: { name: { contains: 'aron', mode: 'insensitive' } } },
            ],
          },
        ],
      });
    });

    it('wraps a to-many relation path in `some`', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'], relations: { tokens: { picks: ['name'] } } },
        },
        search: 'prod',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { name: { contains: 'prod', mode: 'insensitive' } },
              { tokens: { some: { name: { contains: 'prod', mode: 'insensitive' } } } },
            ],
          },
        ],
      });
    });

    it("folds a to-many visit's where into the same `some` as the search clause", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            picks: [],
            relations: {
              tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
        search: 'prod',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              {
                tokens: {
                  some: {
                    AND: [{ name: { contains: 'prod', mode: 'insensitive' } }, { isActive: { equals: true } }],
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it('folds a visit where with a dotted to-one path — the guard walks a relation off the visited model', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            picks: [],
            relations: {
              tokens: { picks: ['name'], where: { field: 'user.emailVerified', operator: 'equals', value: true } },
            },
          },
        },
        search: 'prod',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              {
                tokens: {
                  some: {
                    AND: [
                      { name: { contains: 'prod', mode: 'insensitive' } },
                      { user: { emailVerified: { equals: true } } },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it('folds a soft-delete guard (`notExists` → equals null) into the `some`', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            picks: [],
            relations: {
              tokens: { picks: ['name'], where: { field: 'deletedAt', operator: 'notExists' } },
            },
          },
        },
        search: 'prod',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              {
                tokens: {
                  some: {
                    AND: [{ name: { contains: 'prod', mode: 'insensitive' } }, { deletedAt: { equals: null } }],
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it("folds a to-one visit's where into the hop (direct nesting, no `some`)", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('Inquiry'),
          root: {
            picks: [],
            relations: {
              sourceUser: { picks: ['email'], where: { field: 'emailVerified', operator: 'equals', value: true } },
            },
          },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              {
                sourceUser: {
                  AND: [{ email: { contains: 'aron', mode: 'insensitive' } }, { emailVerified: { equals: true } }],
                },
              },
            ],
          },
        ],
      });
    });

    it("a relation visit's where stays out of the query when nothing traverses the relation", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            picks: ['name'],
            relations: {
              tokens: { picks: [], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [{ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }] }],
      });
    });

    it('drops non-String paths (contains is meaningless for enums / DateTime / Boolean)', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name', 'platformRole', 'createdAt', 'emailVerified'] },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [{ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }] }],
      });
    });

    it('emits no OR when every searchable field is non-String', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['platformRole', 'createdAt'] },
        },
        search: 'foo',
      });
      expect(result).toEqual({});
    });

    it('returns empty when there is no search term and no searchFields', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
      });
      expect(result).toEqual({});
    });
  });

  describe('searchFields — bare value applies the kind default operator', () => {
    it('String → contains + insensitive mode', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
        searchFields: { name: 'aron' },
      });
      expect(result).toEqual({
        AND: [{ name: { contains: 'aron', mode: 'insensitive' } }],
      });
    });

    it('enum → equals (no contains, no mode)', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['platformRole'] },
        },
        searchFields: { platformRole: 'superadmin' },
      });
      expect(result).toEqual({
        AND: [{ platformRole: { equals: 'superadmin' } }],
      });
    });

    it('Int → equals, with string coercion to number', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('CronJob'),
          root: { picks: ['maxAttempts'] },
        },
        searchFields: { maxAttempts: '3' },
      });
      expect(result).toEqual({ AND: [{ maxAttempts: { equals: 3 } }] });
    });

    it('Boolean → equals, coercing "true" / "false" strings', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['emailVerified'] },
        },
        searchFields: { emailVerified: 'true' },
      });
      expect(result).toEqual({ AND: [{ emailVerified: { equals: true } }] });
    });

    it('DateTime → equals with Date coercion from ISO string', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['createdAt'] },
        },
        searchFields: { createdAt: '2026-05-10T12:00:00Z' },
      });
      const inner = (result as { AND: Array<{ createdAt: { equals: Date } }> }).AND[0].createdAt;
      expect(inner.equals).toBeInstanceOf(Date);
      expect(inner.equals.toISOString()).toBe('2026-05-10T12:00:00.000Z');
    });

    it('DateTime → equals with Date coercion from ms-timestamp string', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['createdAt'] },
        },
        searchFields: { createdAt: '1715353200000' },
      });
      const inner = (result as { AND: Array<{ createdAt: { equals: Date } }> }).AND[0].createdAt;
      expect(inner.equals.getTime()).toBe(1715353200000);
    });

    it('Json bare value throws — requires an operator', () => {
      expect(() =>
        buildWhereClause({
          filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
          searchFields: { content: 'anything' },
        }),
      ).toThrow(/requires an operator/);
    });

    it('Json filter builds a Prisma json where (string_contains + path)', () => {
      const where = buildWhereClause({
        filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
        searchFields: { content: { path: 'a.b', string_contains: 'x' } },
      });
      expect(JSON.stringify(where)).toContain('"content":{"path":["a","b"],"string_contains":"x"}');
    });

    it('Json bare null → equals AnyNull (db-NULL or json-null)', () => {
      const where = buildWhereClause({
        filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
        searchFields: { content: null },
      });
      const inner = (where as { AND: Array<{ content: { equals: unknown } }> }).AND[0].content;
      expect(inner.equals).toBe(Prisma.AnyNull);
    });

    it('Json bare true → equals true (symbol, no operator required)', () => {
      const where = buildWhereClause({
        filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
        searchFields: { content: true },
      });
      expect(where).toEqual({ AND: [{ content: { equals: true } }] });
    });

    it('Json bare false → equals false (symbol, no operator required)', () => {
      const where = buildWhereClause({
        filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
        searchFields: { content: false },
      });
      expect(where).toEqual({ AND: [{ content: { equals: false } }] });
    });

    it('Json equals operator preserves a boolean value', () => {
      const where = buildWhereClause({
        filterLens: { parent: lensFor('Inquiry'), root: { picks: ['content'] } },
        searchFields: { content: { equals: true } },
      });
      expect(where).toEqual({ AND: [{ content: { equals: true } }] });
    });
  });

  describe('searchFields — explicit operators', () => {
    it("auto-adds mode: 'insensitive' for String + mode-capable ops", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
        searchFields: { name: { startsWith: 'A' } },
      });
      expect(result).toEqual({
        AND: [{ name: { startsWith: 'A', mode: 'insensitive' } }],
      });
    });

    it("doesn't add mode when caller explicitly passes mode", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
        searchFields: { name: { contains: 'A', mode: 'default' } },
      });
      expect(result).toEqual({
        AND: [{ name: { contains: 'A', mode: 'default' } }],
      });
    });

    it("doesn't add mode for String in/notIn (Prisma doesn't support mode on those)", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['email'] },
        },
        searchFields: { email: { in: ['a@x.com', 'b@x.com'] } },
      });
      expect(result).toEqual({
        AND: [{ email: { in: ['a@x.com', 'b@x.com'] } }],
      });
    });

    it("doesn't add mode for enum equals (mode is a String-only Prisma concept)", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['platformRole'] },
        },
        searchFields: { platformRole: { equals: 'superadmin' } },
      });
      expect(result).toEqual({
        AND: [{ platformRole: { equals: 'superadmin' } }],
      });
    });

    it('coerces Int operator values', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('CronJob'),
          root: { picks: ['maxAttempts'] },
        },
        searchFields: { maxAttempts: { gte: '5', lt: '10' } },
      });
      expect(result).toEqual({ AND: [{ maxAttempts: { gte: 5, lt: 10 } }] });
    });

    it('coerces DateTime operator values (ISO string and ms-timestamp)', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['createdAt'] },
        },
        searchFields: { createdAt: { gte: '2026-01-01T00:00:00Z', lt: '1735689600000' } },
      });
      const clause = (result as { AND: Array<{ createdAt: { gte: Date; lt: Date } }> }).AND[0].createdAt;
      expect(clause.gte).toBeInstanceOf(Date);
      expect(clause.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(clause.lt.getTime()).toBe(1735689600000);
    });

    it('normalises singleton in value to an array', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['platformRole'] },
        },
        searchFields: { platformRole: { in: 'superadmin' } },
      });
      expect(result).toEqual({
        AND: [{ platformRole: { in: ['superadmin'] } }],
      });
    });
  });

  describe('searchFields — operator validation per kind', () => {
    it("rejects 'contains' on enum field", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['platformRole'] },
          },
          searchFields: { platformRole: { contains: 'super' } },
        }),
      ).toThrow(/Operator 'contains' is not valid for field 'platformRole' \(enum\)/);
    });

    it("rejects 'gt' on String field", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['name'] },
          },
          searchFields: { name: { gt: 'a' } },
        }),
      ).toThrow(/Operator 'gt' is not valid for field 'name' \(String\)/);
    });

    it("rejects 'in' on DateTime field", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['createdAt'] },
          },
          searchFields: { createdAt: { in: ['2026-01-01'] } },
        }),
      ).toThrow(/Operator 'in' is not valid for field 'createdAt' \(DateTime\)/);
    });

    it("rejects 'contains' on Boolean field", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['emailVerified'] },
          },
          searchFields: { emailVerified: { contains: 'tr' } },
        }),
      ).toThrow(/not valid for field 'emailVerified' \(Boolean\)/);
    });
  });

  describe('searchFields — coercion errors', () => {
    it('throws on non-numeric Int input', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('CronJob'),
            root: { picks: ['maxAttempts'] },
          },
          searchFields: { maxAttempts: 'abc' },
        }),
      ).toThrow(/Cannot coerce/);
    });

    it("throws on Boolean inputs that aren't true/false strings", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['emailVerified'] },
          },
          searchFields: { emailVerified: 'yes' },
        }),
      ).toThrow(/Cannot coerce/);
    });

    it('throws on garbage DateTime input', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['createdAt'] },
          },
          searchFields: { createdAt: 'not-a-date' },
        }),
      ).toThrow(/Cannot coerce/);
    });
  });

  describe('picks whitelist', () => {
    it('throws when a field is not in picks', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['name'] },
          },
          searchFields: { name: 'aron', password: 'secret' },
        }),
      ).toThrow(/'password' is not searchable/);
    });

    it('throws on invalid path notation', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            // Picks accepts only valid field names — invalid notation rejected via incoming searchFields path
            root: { picks: ['name'] },
          },
          searchFields: { 'bad path!': 'x' },
        }),
      ).toThrow(/Invalid search field|not searchable/);
    });
  });

  describe('relation operators (some / every / none / is / isNot)', () => {
    it('threads through `some` filter into a to-many relation', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { relations: { tokens: { picks: ['name'] } } },
        },
        searchFields: { tokens: { some: { name: 'tok-prod' } } },
      });
      expect(result).toEqual({
        AND: [{ tokens: { some: { name: { contains: 'tok-prod', mode: 'insensitive' } } } }],
      });
    });

    it('threads through `every` with kind-aware coercion on the nested field', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { relations: { tokens: { picks: ['isActive'] } } },
        },
        searchFields: { tokens: { every: { isActive: 'true' } } },
      });
      expect(result).toEqual({
        AND: [{ tokens: { every: { isActive: { equals: true } } } }],
      });
    });

    it("folds the visit's where into `some` — scope and condition on the same row", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            relations: {
              tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
        searchFields: { tokens: { some: { name: 'tok-prod' } } },
      });
      expect(result).toEqual({
        AND: [
          {
            tokens: {
              some: {
                AND: [{ name: { contains: 'tok-prod', mode: 'insensitive' } }, { isActive: { equals: true } }],
              },
            },
          },
        ],
      });
    });

    it("composes the visit's where into `every` by implication, not plain AND", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: {
            relations: {
              tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
        searchFields: { tokens: { every: { name: 'tok-prod' } } },
      });
      expect(result).toEqual({
        AND: [
          {
            tokens: {
              every: {
                OR: [
                  { NOT: { AND: [{ isActive: { equals: true } }] } },
                  { name: { contains: 'tok-prod', mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    });

    it("folds the visit's where into plain to-one nesting (Prisma's `is` shorthand)", () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('Inquiry'),
          root: {
            relations: {
              sourceUser: { picks: ['name'], where: { field: 'emailVerified', operator: 'equals', value: true } },
            },
          },
        },
        searchFields: { sourceUser: { name: 'aron' } },
      });
      expect(result).toEqual({
        AND: [
          {
            sourceUser: {
              AND: [{ name: { contains: 'aron', mode: 'insensitive' } }, { emailVerified: { equals: true } }],
            },
          },
        ],
      });
    });

    it('rejects non-whitelisted relation paths', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['email'] },
          },
          searchFields: { tokens: { some: { name: 'x' } } },
        }),
      ).toThrow(/'tokens' is not searchable/);
    });
  });

  describe('skipFieldValidation (superadmin bypass)', () => {
    it('allows fields not in picks when bypass is on', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: [] },
        },
        searchFields: { name: 'aron', platformRole: 'user' },
        skipFieldValidation: true,
      });
      expect(result).toEqual({
        AND: [{ name: { contains: 'aron', mode: 'insensitive' } }, { platformRole: { equals: 'user' } }],
      });
    });

    it("still validates operators per kind — bypass doesn't loosen kind rules", () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: [] },
          },
          searchFields: { platformRole: { contains: 'super' } },
          skipFieldValidation: true,
        }),
      ).toThrow(/Operator 'contains' is not valid for field 'platformRole'/);
    });

    it('passes through fields that do not resolve in the schema (synthetic / dynamic paths)', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: [] },
        },
        searchFields: { _customField: 'anything' },
        skipFieldValidation: true,
      });
      expect(result).toEqual({ AND: [{ _customField: 'anything' }] });
    });
  });

  describe('filters + orNullFields', () => {
    it('combines pre-built filters with search', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
        search: 'aron',
        filters: { deletedAt: null },
      });
      expect(result).toEqual({
        deletedAt: null,
        AND: [{ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }] }],
      });
    });

    it('widens orNullFields to OR null', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: ['name'] },
        },
        searchFields: { name: 'aron' },
        orNullFields: ['name'],
      });
      expect(result).toEqual({
        AND: [{ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }, { name: null }] }],
      });
    });
  });

  describe('edge cases', () => {
    it('rejects array values without an operator', () => {
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['name'] },
          },
          searchFields: { name: ['a', 'b'] },
        }),
      ).toThrow(/does not support array values without an operator/);
    });

    it('rejects nesting deeper than 10 levels', () => {
      let nested: Record<string, unknown> = { value: 'leaf' };
      for (let i = 0; i < 11; i += 1) nested = { wrap: nested };
      expect(() =>
        buildWhereClause({
          filterLens: {
            parent: lensFor('User'),
            root: { picks: ['wrap'] },
          },
          searchFields: nested as never,
          skipFieldValidation: true,
        }),
      ).toThrow(/Search query nesting too deep/);
    });
  });

  describe('row scope (narrowing chain composition)', () => {
    const role = { platformRole: { equals: 'superadmin' } };
    const verified = { emailVerified: { equals: true } };
    const named = { name: { equals: 'x' } };

    it('applies the route layer root.where', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: [], where: { field: 'platformRole', operator: 'equals', value: 'superadmin' } },
        },
      });
      expect(result).toEqual({ AND: [role] });
    });

    it('composes every stacked scopeNarrowing layer (route + children), ANDed', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: {
            parent: lensFor('User'),
            root: { picks: [], where: { field: 'platformRole', operator: 'equals', value: 'superadmin' } },
          },
          root: { where: { field: 'emailVerified', operator: 'equals', value: true } },
        },
      });
      const and = (result as { AND: unknown[] }).AND;
      expect(and).toHaveLength(2);
      expect(and).toEqual(expect.arrayContaining([role, verified]));
    });

    it('applies mapDefaults wheres anchored to the root model', () => {
      const result = buildWhereClause({
        filterLens: {
          parent: lensFor('User'),
          root: { picks: [] },
          mapDefaults: { prisma: { models: { User: { where: { field: 'name', operator: 'equals', value: 'x' } } } } },
        },
      });
      expect(result).toEqual({ AND: [named] });
    });
  });
});
