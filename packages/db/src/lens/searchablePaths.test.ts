import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens/lensFor';
import { searchablePaths } from '@template/db/lens/searchablePaths';

const inquiryLens = lensFor('Inquiry');
const userLens = lensFor('User');
const accountLens = lensFor('Account');

describe('searchablePaths', () => {
  describe('redaction (registry-driven)', () => {
    it('omits redacted fields from the root model', () => {
      const paths = searchablePaths({ parent: accountLens });
      expect(paths).not.toContain('password');
      expect(paths).toContain('accountId');
    });

    it('omits redacted fields wherever the model appears via relations', () => {
      const paths = searchablePaths({
        parent: userLens,
        root: { relations: { accounts: {} } },
      });
      expect(paths.some((p) => p.startsWith('accounts.'))).toBe(true);
      expect(paths).not.toContain('accounts.password');
    });
  });

  describe('picks at root', () => {
    it('returns picked scalar/enum fields', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: { picks: ['type', 'status'] },
      });
      expect(paths.sort()).toEqual(['status', 'type']);
    });

    it('returns empty when picks is empty array', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: { picks: [] },
      });
      expect(paths).toEqual([]);
    });
  });

  describe('omits at root', () => {
    it('returns scalar/enum fields except omitted (no picks → all scalars/enums)', () => {
      const paths = searchablePaths({
        parent: userLens,
        root: { omits: ['platformRole'] },
      });
      expect(paths).not.toContain('platformRole');
      expect(paths).toContain('name');
      expect(paths).toContain('email');
    });
  });

  describe('picks + omits composed', () => {
    it('omits applied after picks (picks minus omits)', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: { picks: ['type', 'status', 'sourceModel'], omits: ['status'] },
      });
      expect(paths.sort()).toEqual(['sourceModel', 'type']);
    });
  });

  describe('relations declarations', () => {
    it('descends into declared relations and prefixes paths', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          picks: ['type'],
          relations: {
            sourceUser: { picks: ['name', 'email'] },
          },
        },
      });
      expect(paths.sort()).toEqual(['sourceUser.email', 'sourceUser.name', 'type']);
    });

    it('relation descent with omits-only at the sub-level', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          relations: {
            sourceUser: { omits: ['platformRole'] },
          },
        },
      });
      // Root has no picks/omits → root scalars also enumerated (full open at root)
      expect(paths).toContain('sourceUser.name');
      expect(paths).toContain('sourceUser.email');
      expect(paths).not.toContain('sourceUser.platformRole');
    });

    it('recurses nested relations (relation paths present alongside root open)', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          relations: {
            sourceUser: {
              picks: ['name'],
              relations: {
                organizationUsers: { picks: ['role'] },
              },
            },
          },
        },
      });
      expect(paths).toContain('sourceUser.name');
      expect(paths).toContain('sourceUser.organizationUsers.role');
      // sourceUser sub-narrowing has picks → only name picked, not other User fields
      expect(paths).not.toContain('sourceUser.email');
    });
  });

  describe('mixed composition', () => {
    it('picks at root + relations descent in same narrowing', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          picks: ['type', 'status'],
          relations: {
            sourceUser: { picks: ['name'] },
            sourceOrganization: { picks: ['slug'] },
          },
        },
      });
      expect(paths.sort()).toEqual(['sourceOrganization.slug', 'sourceUser.name', 'status', 'type']);
    });

    it('multiple relations targeting SAME model — picks stay PATH-SCOPED (no sibling leak)', () => {
      // sourceUser:User picks ['name'] and targetUser:User picks ['email'] both target User.
      // projectByPath keeps each visit's picks isolated to its own path, so the
      // sibling field never leaks across paths.
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          picks: ['type'],
          relations: {
            sourceUser: { picks: ['name'] },
            targetUser: { picks: ['email'] },
          },
        },
      });
      expect(paths.sort()).toEqual(['sourceUser.name', 'targetUser.email', 'type']);
    });
  });

  describe('does not traverse undeclared relations', () => {
    it('picks declared at root, no relations → just the picked root fields', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: { picks: ['type'] },
      });
      expect(paths).toEqual(['type']);
    });

    it('declared relation does NOT auto-walk into its sub-relations', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: { relations: { sourceUser: { picks: ['name'] } } },
      });
      // sourceUser picks: ['name'] → only 'sourceUser.name'. No deeper paths from User's relations.
      expect(paths).toContain('sourceUser.name');
      expect(paths.some((p) => p.startsWith('sourceUser.') && p.split('.').length > 2)).toBe(false);
    });

    it('no cycle: User → orgUsers → user back-ref not enumerated unless declared', () => {
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          relations: {
            sourceUser: {
              picks: ['name'],
              relations: {
                organizationUsers: { picks: ['role'] },
              },
            },
          },
        },
      });
      expect(paths).toContain('sourceUser.name');
      expect(paths).toContain('sourceUser.organizationUsers.role');
      // organizationUsers picks: ['role'] → no descent into .user back-ref or .organization
      expect(paths.some((p) => p.startsWith('sourceUser.organizationUsers.') && p.split('.').length > 3)).toBe(false);
    });
  });

  describe('empty narrowing (admin / open mode)', () => {
    it('no root narrowing → all scalar/enum fields on root model, no relations descended', () => {
      const paths = searchablePaths({ parent: inquiryLens });
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('.'))).toBe(false);
      expect(paths).toContain('type');
      expect(paths).toContain('status');
    });
  });

  describe('dot-paths in picks (not auto-traversed)', () => {
    it('dot-paths in picks are opaque strings; projection drops them', () => {
      // 'sourceUser.name' is not a literal field on Inquiry, so projection drops it.
      // The explicit relations declaration is the only thing that enumerates relation paths.
      const paths = searchablePaths({
        parent: inquiryLens,
        root: {
          picks: ['type', 'sourceUser.name'],
          relations: { sourceUser: { picks: ['email'] } },
        },
      });
      expect(paths.sort()).toEqual(['sourceUser.email', 'type']);
      expect(paths).not.toContain('sourceUser.name');
    });
  });
});
