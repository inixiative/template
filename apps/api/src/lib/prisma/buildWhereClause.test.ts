import { lensFor } from '@template/db/lens';
import { describe, expect, it } from 'bun:test';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';

describe('buildWhereClause', () => {
  describe('global search (single term, fan-out across fields)', () => {
    it('emits a case-insensitive OR across String fields', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name', 'email'] } } } },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { name: { contains: 'aron', mode: 'insensitive' } },
              { email: { contains: 'aron', mode: 'insensitive' } },
            ],
          },
        ],
      });
    });

    it('walks relation paths', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('Inquiry'),
          maps: { prisma: { models: { Inquiry: { picks: ['sourceUser.name', 'sourceUser.email'] } } } },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { sourceUser: { name: { contains: 'aron', mode: 'insensitive' } } },
              { sourceUser: { email: { contains: 'aron', mode: 'insensitive' } } },
            ],
          },
        ],
      });
    });

    it('drops non-String paths (contains is meaningless for enums / DateTime / Boolean)', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name', 'platformRole', 'createdAt', 'emailVerified'] } } } },
        },
        search: 'aron',
      });
      expect(result).toEqual({
        AND: [{ OR: [{ name: { contains: 'aron', mode: 'insensitive' } }] }],
      });
    });

    it('emits no OR when every searchable field is non-String', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['platformRole', 'createdAt'] } } } },
        },
        search: 'foo',
      });
      expect(result).toEqual({});
    });

    it('returns empty when there is no search term and no searchFields', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
        },
      });
      expect(result).toEqual({});
    });
  });

  describe('searchFields — bare value applies the kind default operator', () => {
    it('String → contains + insensitive mode', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
        },
        searchFields: { name: 'aron' },
      });
      expect(result).toEqual({
        AND: [{ name: { contains: 'aron', mode: 'insensitive' } }],
      });
    });

    it('enum → equals (no contains, no mode)', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['platformRole'] } } } },
        },
        searchFields: { platformRole: 'superadmin' },
      });
      expect(result).toEqual({
        AND: [{ platformRole: { equals: 'superadmin' } }],
      });
    });

    it('Int → equals, with string coercion to number', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('CronJob'),
          maps: { prisma: { models: { CronJob: { picks: ['maxAttempts'] } } } },
        },
        searchFields: { maxAttempts: '3' },
      });
      expect(result).toEqual({ AND: [{ maxAttempts: { equals: 3 } }] });
    });

    it('Boolean → equals, coercing "true" / "false" strings', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['emailVerified'] } } } },
        },
        searchFields: { emailVerified: 'true' },
      });
      expect(result).toEqual({ AND: [{ emailVerified: { equals: true } }] });
    });

    it('DateTime → equals with Date coercion from ISO string', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['createdAt'] } } } },
        },
        searchFields: { createdAt: '2026-05-10T12:00:00Z' },
      });
      const inner = (result as { AND: Array<{ createdAt: { equals: Date } }> }).AND[0].createdAt;
      expect(inner.equals).toBeInstanceOf(Date);
      expect(inner.equals.toISOString()).toBe('2026-05-10T12:00:00.000Z');
    });

    it('DateTime → equals with Date coercion from ms-timestamp string', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['createdAt'] } } } },
        },
        searchFields: { createdAt: '1715353200000' },
      });
      const inner = (result as { AND: Array<{ createdAt: { equals: Date } }> }).AND[0].createdAt;
      expect(inner.equals.getTime()).toBe(1715353200000);
    });

    it('Json fields throw — not searchable via this surface', () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('Inquiry'),
            maps: { prisma: { models: { Inquiry: { picks: ['content'] } } } },
          },
          searchFields: { content: 'anything' },
        }),
      ).toThrow(/JSON fields aren't searchable/);
    });
  });

  describe('searchFields — explicit operators', () => {
    it("auto-adds mode: 'insensitive' for String + mode-capable ops", () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
        },
        searchFields: { name: { startsWith: 'A' } },
      });
      expect(result).toEqual({
        AND: [{ name: { startsWith: 'A', mode: 'insensitive' } }],
      });
    });

    it("doesn't add mode when caller explicitly passes mode", () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
        },
        searchFields: { name: { contains: 'A', mode: 'default' } },
      });
      expect(result).toEqual({
        AND: [{ name: { contains: 'A', mode: 'default' } }],
      });
    });

    it("doesn't add mode for String in/notIn (Prisma doesn't support mode on those)", () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['email'] } } } },
        },
        searchFields: { email: { in: ['a@x.com', 'b@x.com'] } },
      });
      expect(result).toEqual({
        AND: [{ email: { in: ['a@x.com', 'b@x.com'] } }],
      });
    });

    it("doesn't add mode for enum equals (mode is a String-only Prisma concept)", () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['platformRole'] } } } },
        },
        searchFields: { platformRole: { equals: 'superadmin' } },
      });
      expect(result).toEqual({
        AND: [{ platformRole: { equals: 'superadmin' } }],
      });
    });

    it('coerces Int operator values', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('CronJob'),
          maps: { prisma: { models: { CronJob: { picks: ['maxAttempts'] } } } },
        },
        searchFields: { maxAttempts: { gte: '5', lt: '10' } },
      });
      expect(result).toEqual({ AND: [{ maxAttempts: { gte: 5, lt: 10 } }] });
    });

    it('coerces DateTime operator values (ISO string and ms-timestamp)', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['createdAt'] } } } },
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
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['platformRole'] } } } },
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
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['platformRole'] } } } },
          },
          searchFields: { platformRole: { contains: 'super' } },
        }),
      ).toThrow(/Operator 'contains' is not valid for field 'platformRole' \(enum\)/);
    });

    it("rejects 'gt' on String field", () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['name'] } } } },
          },
          searchFields: { name: { gt: 'a' } },
        }),
      ).toThrow(/Operator 'gt' is not valid for field 'name' \(String\)/);
    });

    it("rejects 'in' on DateTime field", () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['createdAt'] } } } },
          },
          searchFields: { createdAt: { in: ['2026-01-01'] } },
        }),
      ).toThrow(/Operator 'in' is not valid for field 'createdAt' \(DateTime\)/);
    });

    it("rejects 'contains' on Boolean field", () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['emailVerified'] } } } },
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
          narrowing: {
            parent: lensFor('CronJob'),
            maps: { prisma: { models: { CronJob: { picks: ['maxAttempts'] } } } },
          },
          searchFields: { maxAttempts: 'abc' },
        }),
      ).toThrow(/Cannot coerce/);
    });

    it("throws on Boolean inputs that aren't true/false strings", () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['emailVerified'] } } } },
          },
          searchFields: { emailVerified: 'yes' },
        }),
      ).toThrow(/Cannot coerce/);
    });

    it('throws on garbage DateTime input', () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['createdAt'] } } } },
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
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['name'] } } } },
          },
          searchFields: { name: 'aron', password: 'secret' },
        }),
      ).toThrow(/'password' is not searchable/);
    });

    it('throws on invalid path notation', () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['bad path!'] } } } },
          },
          searchFields: { 'bad path!': 'x' },
        }),
      ).toThrow(/Invalid search field/);
    });
  });

  describe('relation operators (some / every / none / is / isNot)', () => {
    it('threads through `some` filter into a to-many relation', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['tokens.name'] } } } },
        },
        searchFields: { tokens: { some: { name: 'tok-prod' } } },
      });
      expect(result).toEqual({
        AND: [{ tokens: { some: { name: { contains: 'tok-prod', mode: 'insensitive' } } } }],
      });
    });

    it('threads through `every` with kind-aware coercion on the nested field', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['tokens.isActive'] } } } },
        },
        searchFields: { tokens: { every: { isActive: 'true' } } },
      });
      expect(result).toEqual({
        AND: [{ tokens: { every: { isActive: { equals: true } } } }],
      });
    });

    it('rejects non-whitelisted relation paths', () => {
      expect(() =>
        buildWhereClause({
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['email'] } } } },
          },
          searchFields: { tokens: { some: { name: 'x' } } },
        }),
      ).toThrow(/'tokens' is not searchable/);
    });
  });

  describe('skipFieldValidation (superadmin bypass)', () => {
    it('allows fields not in picks when bypass is on', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: [] } } } },
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
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: [] } } } },
          },
          searchFields: { platformRole: { contains: 'super' } },
          skipFieldValidation: true,
        }),
      ).toThrow(/Operator 'contains' is not valid for field 'platformRole'/);
    });

    it('passes through fields that do not resolve in the schema (synthetic / dynamic paths)', () => {
      const result = buildWhereClause({
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: [] } } } },
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
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
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
        narrowing: {
          parent: lensFor('User'),
          maps: { prisma: { models: { User: { picks: ['name'] } } } },
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
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['name'] } } } },
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
          narrowing: {
            parent: lensFor('User'),
            maps: { prisma: { models: { User: { picks: ['wrap'] } } } },
          },
          searchFields: nested as never,
          skipFieldValidation: true,
        }),
      ).toThrow(/Search query nesting too deep/);
    });
  });
});
