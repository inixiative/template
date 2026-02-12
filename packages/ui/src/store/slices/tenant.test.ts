import { buildOrganization } from '@template/db/test';
import { createTestStore } from '@template/ui/test';
import { beforeEach, describe, expect, it } from 'vitest';

describe('tenant slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { tenant } = store.getState();

      expect(tenant.context).toEqual({ type: 'public' });
      expect(tenant.page).toEqual({});
    });

    it('should have required methods', () => {
      const { tenant } = store.getState();

      expect(typeof tenant.setPublic).toBe('function');
      expect(typeof tenant.setUser).toBe('function');
      expect(typeof tenant.setOrganization).toBe('function');
      expect(typeof tenant.setSpace).toBe('function');
      expect(typeof tenant.setPage).toBe('function');
      expect(typeof tenant.clearPage).toBe('function');
    });
  });

  describe('setPublic', () => {
    it('should set context to public', () => {
      // Start with user context
      store.setState({
        tenant: {
          ...store.getState().tenant,
          context: { type: 'user' },
        },
      });

      store.getState().tenant.setPublic();

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({ type: 'public' });
    });
  });

  describe('setUser', () => {
    it('should set context to user', () => {
      store.getState().tenant.setUser();

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({ type: 'user' });
    });

    it('should switch from public to user', () => {
      expect(store.getState().tenant.context.type).toBe('public');

      store.getState().tenant.setUser();

      expect(store.getState().tenant.context.type).toBe('user');
    });
  });

  describe('setOrganization', () => {
    it('should return false when organization does not exist', () => {
      const result = store.getState().tenant.setOrganization('nonexistent-id');

      expect(result).toBe(false);
      expect(store.getState().tenant.context).toEqual({ type: 'public' });
    });

    it('should return false when auth.organizations is null', () => {
      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: null,
        },
      });

      const result = store.getState().tenant.setOrganization('org-1');

      expect(result).toBe(false);
    });

    it('should set context to organization when it exists', () => {
      const mockOrg = { id: 'org-1', name: 'Test Org' } as any;

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg },
        },
      });

      const result = store.getState().tenant.setOrganization('org-1');

      expect(result).toBe(true);
      expect(store.getState().tenant.context).toEqual({
        type: 'organization',
        organization: mockOrg,
      });
    });
  });

  describe('setSpace', () => {
    it('should return false when space does not exist', () => {
      const result = store.getState().tenant.setSpace('nonexistent-id');

      expect(result).toBe(false);
      expect(store.getState().tenant.context).toEqual({ type: 'public' });
    });

    it('should return false when auth.spaces is null', () => {
      store.setState({
        auth: {
          ...store.getState().auth,
          spaces: null,
        },
      });

      const result = store.getState().tenant.setSpace('space-1');

      expect(result).toBe(false);
    });

    it('should return false when organization for space does not exist', () => {
      const mockSpace = { id: 'space-1', name: 'Test Space', organizationId: 'org-1' } as any;

      store.setState({
        auth: {
          ...store.getState().auth,
          spaces: { 'space-1': mockSpace },
          organizations: {},
        },
      });

      const result = store.getState().tenant.setSpace('space-1');

      expect(result).toBe(false);
    });

    it('should set context to space when it and its organization exist', () => {
      const mockOrg = { id: 'org-1', name: 'Test Org' } as any;
      const mockSpace = { id: 'space-1', name: 'Test Space', organizationId: 'org-1' } as any;

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg },
          spaces: { 'space-1': mockSpace },
        },
      });

      const result = store.getState().tenant.setSpace('space-1');

      expect(result).toBe(true);
      expect(store.getState().tenant.context).toEqual({
        type: 'space',
        organization: mockOrg,
        space: mockSpace,
      });
    });
  });

  describe('setPage and clearPage', () => {
    it('should set page context', async () => {
      const { entity: mockOrg } = await buildOrganization({ id: 'org-1', name: 'Page Org' });
      const pageContext = { organization: mockOrg as any };

      store.getState().tenant.setPage(pageContext);

      expect(store.getState().tenant.page).toEqual(pageContext);
    });

    it('should clear page context', async () => {
      // Set some page context first
      const { entity: mockOrg } = await buildOrganization({ id: 'org-1', name: 'Page Org' });
      store.setState({
        tenant: {
          ...store.getState().tenant,
          page: { organization: mockOrg as any },
        },
      });

      store.getState().tenant.clearPage();

      expect(store.getState().tenant.page).toEqual({});
    });

    it('should preserve tenant context when setting page', async () => {
      const { entity: mockOrg } = await buildOrganization({ id: 'org-1', name: 'Test Org' });

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg as any },
        },
      });

      store.getState().tenant.setOrganization('org-1');
      const { entity: pageOrg } = await buildOrganization({ id: 'page-org-1', name: 'Page Org' });
      store.getState().tenant.setPage({ organization: pageOrg as any });

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({
        type: 'organization',
        organization: mockOrg,
      });
      expect(tenant.page).toEqual({ organization: pageOrg });
    });
  });
});
