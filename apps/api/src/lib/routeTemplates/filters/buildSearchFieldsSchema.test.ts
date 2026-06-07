import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { buildSearchFieldsSchema } from '#/lib/routeTemplates/filters/buildSearchFieldsSchema';

// User → organizationUsers (to-many) → role (enum: owner/admin/member/viewer), narrowed to admin/member.
const userLens: LensNarrowing = {
  parent: lensFor('User'),
  root: {
    picks: ['name', 'email', 'createdAt'],
    relations: {
      organizationUsers: { picks: ['role', 'createdAt'], enumPicks: { role: ['admin', 'member'] } },
    },
  },
};

describe('buildSearchFieldsSchema', () => {
  const schema = buildSearchFieldsSchema(userLens);
  if (!schema) throw new Error('expected a schema');
  const ok = (v: unknown) => expect(schema.safeParse(v).success).toBe(true);
  const bad = (v: unknown) => expect(schema.safeParse(v).success).toBe(false);

  it('String: allows contains, rejects gt (operators from getValidOperators)', () => {
    ok({ name: { contains: 'a' } });
    bad({ name: { gt: 'a' } });
  });

  it('DateTime: allows gt, rejects in (server allows no in/notIn on DateTime)', () => {
    ok({ createdAt: { gt: '2020-01-01' } });
    bad({ createdAt: { in: ['2020-01-01'] } });
  });

  it('to-many relation: full some/every/none', () => {
    ok({ organizationUsers: { some: { role: { equals: 'admin' } } } });
    ok({ organizationUsers: { every: { role: { equals: 'member' } } } });
    ok({ organizationUsers: { none: { role: { equals: 'admin' } } } });
  });

  it('enum comes narrowed: accepts narrowed value, rejects out-of-narrowing value', () => {
    ok({ organizationUsers: { some: { role: { equals: 'admin' } } } });
    bad({ organizationUsers: { some: { role: { equals: 'owner' } } } });
  });

  it('rejects unknown fields (strict)', () => {
    bad({ notAField: { equals: 'x' } });
  });

  it('accepts a bare value (no operator) — defaults to the field operator at runtime', () => {
    ok({ name: 'dragon' });
    ok({ organizationUsers: { some: { role: 'admin' } } });
  });
});

describe('buildSearchFieldsSchema (json)', () => {
  const jsonLens: LensNarrowing = { parent: lensFor('Contact'), root: { picks: ['permissionRules'] } };
  const schema = buildSearchFieldsSchema(jsonLens);

  it('json field gets the open-ended JsonFilter', () => {
    expect(schema).toBeDefined();
    expect(schema?.safeParse({ permissionRules: { string_contains: 'x' } }).success).toBe(true);
    expect(schema?.safeParse({ permissionRules: { path: ['a', 'b'], equals: 'x' } }).success).toBe(true);
  });
});

describe('buildSearchFieldsSchema — null + boolean values', () => {
  const lens: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name', 'emailVerified'] } };
  const schema = buildSearchFieldsSchema(lens);
  if (!schema) throw new Error('expected a schema');

  it('allows null on equals/not (is-null / is-set)', () => {
    expect(schema.safeParse({ name: { equals: null } }).success).toBe(true);
    expect(schema.safeParse({ name: { not: null } }).success).toBe(true);
  });

  it('Boolean field takes a boolean value, rejects the string form', () => {
    expect(schema.safeParse({ emailVerified: { equals: true } }).success).toBe(true);
    expect(schema.safeParse({ emailVerified: { equals: 'true' } }).success).toBe(false);
  });
});
