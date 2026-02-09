import { describe, expect, it } from 'bun:test';
import { buildWhereClause } from '#/lib/prisma/buildWhereClause';

describe('buildWhereClause', () => {
  describe('simple search', () => {
    it('builds OR conditions for simple search', () => {
      const result = buildWhereClause({
        search: 'john',
        searchableFields: ['name', 'email'],
      });

      expect(result).toEqual({
        AND: [
          {
            OR: [
              { name: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        ],
      });
    });

    it('supports nested paths in simple search', () => {
      const result = buildWhereClause({
        search: 'test',
        searchableFields: ['name', 'user.email'],
      });

      expect(result).toEqual({
        AND: [
          {
            OR: [
              { name: { contains: 'test', mode: 'insensitive' } },
              { user: { email: { contains: 'test', mode: 'insensitive' } } },
            ],
          },
        ],
      });
    });
  });

  describe('advanced search', () => {
    it('builds AND conditions for field-specific search', () => {
      const result = buildWhereClause({
        searchFields: { name: 'john', email: 'example.com' },
        searchableFields: ['name', 'email'],
      });

      expect(result).toEqual({
        AND: [
          { name: { contains: 'john', mode: 'insensitive' } },
          { email: { contains: 'example.com', mode: 'insensitive' } },
        ],
      });
    });

    it('supports nested paths in advanced search', () => {
      const result = buildWhereClause({
        searchFields: { user: { email: 'test@example.com' } },
        searchableFields: ['user.email'],
      });

      expect(result).toEqual({
        AND: [{ user: { email: { contains: 'test@example.com', mode: 'insensitive' } } }],
      });
    });

    it('throws error for fields not in searchableFields', () => {
      expect(() =>
        buildWhereClause({
          searchFields: { name: 'john', password: 'secret' },
          searchableFields: ['name', 'email'],
        }),
      ).toThrow("Field 'password' is not searchable");
    });
  });

  describe('combined search and filters', () => {
    it('combines simple search with filters', () => {
      const result = buildWhereClause({
        search: 'john',
        searchableFields: ['name'],
        filters: { deletedAt: null },
      });

      expect(result).toEqual({
        deletedAt: null,
        AND: [
          {
            OR: [{ name: { contains: 'john', mode: 'insensitive' } }],
          },
        ],
      });
    });

    it('combines advanced search with filters', () => {
      const result = buildWhereClause({
        searchFields: { name: 'john' },
        searchableFields: ['name'],
        filters: { status: 'active', deletedAt: null },
      });

      expect(result).toEqual({
        status: 'active',
        deletedAt: null,
        AND: [{ name: { contains: 'john', mode: 'insensitive' } }],
      });
    });
  });

  describe('no search', () => {
    it('returns only filters when no search', () => {
      const result = buildWhereClause({
        searchableFields: ['name'],
        filters: { status: 'active' },
      });

      expect(result).toEqual({ status: 'active' });
    });

    it('returns empty object when no search and no filters', () => {
      const result = buildWhereClause({
        searchableFields: ['name'],
      });

      expect(result).toEqual({});
    });
  });

  describe('nested operator format', () => {
    it('handles nested objects with Prisma operators', () => {
      const result = buildWhereClause({
        searchFields: {
          name: { contains: 'john' },
          age: { gte: 18 },
        },
        searchableFields: ['name', 'age'],
      });

      expect(result).toEqual({
        AND: [{ name: { contains: 'john' } }, { age: { gte: 18 } }],
      });
    });

    it('handles deeply nested field paths with operators', () => {
      const result = buildWhereClause({
        searchFields: {
          user: {
            profile: {
              name: { contains: 'john' },
            },
          },
        },
        searchableFields: ['user.profile.name'],
      });

      expect(result).toEqual({
        AND: [{ user: { profile: { name: { contains: 'john' } } } }],
      });
    });

    it('handles relation filters with some', () => {
      const result = buildWhereClause({
        searchFields: {
          posts: {
            some: {
              status: 'published',
            },
          },
        },
        searchableFields: ['posts.status'],
      });

      expect(result).toEqual({
        AND: [{ posts: { some: { status: 'published' } } }],
      });
    });

    it('handles relation filters with every', () => {
      const result = buildWhereClause({
        searchFields: {
          members: {
            every: {
              role: 'admin',
            },
          },
        },
        searchableFields: ['members.role'],
      });

      expect(result).toEqual({
        AND: [{ members: { every: { role: 'admin' } } }],
      });
    });

    it('handles relation filters with none', () => {
      const result = buildWhereClause({
        searchFields: {
          comments: {
            none: {
              flagged: true,
            },
          },
        },
        searchableFields: ['comments.flagged'],
      });

      expect(result).toEqual({
        AND: [{ comments: { none: { flagged: true } } }],
      });
    });

    it('mixes flat strings and nested operators', () => {
      const result = buildWhereClause({
        searchFields: {
          name: 'john',
          age: { gte: 18 },
          email: { endsWith: '@example.com' },
        },
        searchableFields: ['name', 'age', 'email'],
      });

      expect(result).toEqual({
        AND: [
          { name: { contains: 'john', mode: 'insensitive' } },
          { age: { gte: 18 } },
          { email: { endsWith: '@example.com' } },
        ],
      });
    });

    it('rejects non-whitelisted relation fields', () => {
      expect(() =>
        buildWhereClause({
          searchFields: {
            posts: {
              some: {
                secretField: 'hacked',
              },
            },
          },
          searchableFields: ['posts.status'],
        }),
      ).toThrow("Field 'posts.secretField' is not searchable");
    });

    it('handles deeply nested relation paths', () => {
      const result = buildWhereClause({
        searchFields: {
          posts: {
            some: {
              author: {
                name: 'John',
              },
            },
          },
        },
        searchableFields: ['posts.author.name'],
      });

      expect(result).toEqual({
        AND: [{ posts: { some: { author: { name: 'John' } } } }],
      });
    });
  });

  describe('validation', () => {
    it('throws error for invalid path notation in searchable fields', () => {
      expect(() =>
        buildWhereClause({
          search: 'test',
          searchableFields: ['user$email'],
        }),
      ).toThrow('Invalid searchable field');
    });

    it('throws error for invalid path notation in search fields', () => {
      expect(() =>
        buildWhereClause({
          searchFields: { '../admin': 'test' },
          searchableFields: ['../admin'],
        }),
      ).toThrow('Invalid search field');
    });
  });
});
