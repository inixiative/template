import { describe, expect, it } from 'bun:test';
import { Prisma } from '@template/db';
import { parseOrderBy } from './orderBySchema';

describe('orderBySchema', () => {
  describe('parseOrderBy', () => {
    it('parses single field ascending', () => {
      const result = parseOrderBy(['name:asc']);
      expect(result).toEqual([{ name: Prisma.SortOrder.asc }]);
    });

    it('parses single field descending', () => {
      const result = parseOrderBy(['name:desc']);
      expect(result).toEqual([{ name: Prisma.SortOrder.desc }]);
    });

    it('parses multiple fields', () => {
      const result = parseOrderBy(['name:asc', 'createdAt:desc']);
      expect(result).toEqual([
        { name: Prisma.SortOrder.asc },
        { createdAt: Prisma.SortOrder.desc },
      ]);
    });

    it('parses nested field paths', () => {
      const result = parseOrderBy(['user.email:asc']);
      expect(result).toEqual([{ user: { email: Prisma.SortOrder.asc } }]);
    });

    it('parses multiple nested fields', () => {
      const result = parseOrderBy(['user.email:asc', 'organization.name:desc']);
      expect(result).toEqual([
        { user: { email: Prisma.SortOrder.asc } },
        { organization: { name: Prisma.SortOrder.desc } },
      ]);
    });

    it('handles case insensitive directions', () => {
      const result = parseOrderBy(['name:ASC', 'email:DESC']);
      expect(result).toEqual([
        { name: Prisma.SortOrder.asc },
        { email: Prisma.SortOrder.desc },
      ]);
    });

    it('throws error for invalid path notation', () => {
      expect(() => parseOrderBy(['user$email:asc'])).toThrow('Invalid orderBy path');
      expect(() => parseOrderBy(['../user:asc'])).toThrow('Invalid orderBy path');
    });
  });
});
