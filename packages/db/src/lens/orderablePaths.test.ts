import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens/lensFor';
import { orderablePaths } from '@template/db/lens/orderablePaths';

const inquiryLens = lensFor('Inquiry');
const userLens = lensFor('User');
const accountLens = lensFor('Account');

describe('orderablePaths', () => {
  describe('redaction (registry-driven)', () => {
    it('omits redacted fields from the sortable surface', () => {
      const paths = orderablePaths({ parent: accountLens });
      expect(paths).not.toContain('password');
      expect(paths).toContain('accountId');
    });
  });

  describe('to-one edges', () => {
    it('includes leaves reachable through a to-one relation', () => {
      const paths = orderablePaths({
        parent: inquiryLens,
        root: { relations: { sourceUser: { picks: ['name'] } } },
      });
      expect(paths).toContain('sourceUser.name');
    });
  });

  describe('orderable leaves', () => {
    it('includes scalar and enum leaves, excludes Json', () => {
      // content + resolution are Json (not orderable); type/status are enums; createdAt is a scalar.
      const paths = orderablePaths({
        parent: inquiryLens,
        root: { picks: ['type', 'status', 'content', 'createdAt'] },
      });
      expect(paths.sort()).toEqual(['createdAt', 'status', 'type']);
      expect(paths).not.toContain('content');
    });

    it('includes Boolean leaves', () => {
      const paths = orderablePaths({
        parent: userLens,
        root: { picks: ['name', 'emailVerified', 'platformRole'] },
      });
      expect(paths.sort()).toEqual(['emailVerified', 'name', 'platformRole']);
    });
  });

  describe('picks at root', () => {
    it('returns picked scalar/enum fields', () => {
      const paths = orderablePaths({ parent: inquiryLens, root: { picks: ['type', 'status'] } });
      expect(paths.sort()).toEqual(['status', 'type']);
    });

    it('returns empty when picks is empty array', () => {
      const paths = orderablePaths({ parent: inquiryLens, root: { picks: [] } });
      expect(paths).toEqual([]);
    });
  });

  describe('omits at root', () => {
    it('returns scalar/enum fields except omitted (no picks → all scalars/enums)', () => {
      const paths = orderablePaths({ parent: userLens, root: { omits: ['platformRole'] } });
      expect(paths).not.toContain('platformRole');
      expect(paths).toContain('name');
      expect(paths).toContain('email');
    });
  });

  describe('relations declarations', () => {
    it('traverses to-one relations and prefixes paths', () => {
      const paths = orderablePaths({
        parent: inquiryLens,
        root: { picks: ['type'], relations: { sourceUser: { picks: ['name', 'email'] } } },
      });
      expect(paths.sort()).toEqual(['sourceUser.email', 'sourceUser.name', 'type']);
    });

    it('does not auto-walk into undeclared sub-relations', () => {
      const paths = orderablePaths({
        parent: inquiryLens,
        root: { relations: { sourceUser: { picks: ['name'] } } },
      });
      expect(paths).toContain('sourceUser.name');
      expect(paths.some((p) => p.startsWith('sourceUser.') && p.split('.').length > 2)).toBe(false);
    });
  });

  describe('to-many edges', () => {
    it('excludes leaves reachable through a to-many relation (Prisma orderBy cannot sort by a to-many)', () => {
      const paths = orderablePaths({
        parent: userLens,
        root: { picks: ['name'], relations: { accounts: { picks: ['accountId'] } } },
      });
      expect(paths.sort()).toEqual(['name']);
    });
  });

  describe('empty narrowing (admin / open mode)', () => {
    it('no root narrowing → all scalar/enum fields on root model, no relations descended', () => {
      const paths = orderablePaths({ parent: inquiryLens });
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('.'))).toBe(false);
      expect(paths).toContain('type');
      expect(paths).toContain('status');
    });
  });
});
