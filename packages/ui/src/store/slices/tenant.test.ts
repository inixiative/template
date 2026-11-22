import { beforeEach, describe, expect, it } from 'bun:test';
import { buildOrganization, buildSpace } from '@template/db/test';
import type { MeReadResponses } from '@template/sdk';
import { createTestStore } from '@template/ui/test';

type MeData = MeReadResponses[200]['data'];
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];

describe('tenant slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { tenant } = store.getState();

      expect(tenant.context).toEqual({ type: 'public' });
      expect(tenant.viewedRecords).toEqual({});
    });

    it('should have required methods', () => {
      const { tenant } = store.getState();

      expect(typeof tenant.switchToPublicContext).toBe('function');
      expect(typeof tenant.switchToUserContext).toBe('function');
      expect(typeof tenant.switchToOrganizationContext).toBe('function');
      expect(typeof tenant.switchToSpaceContext).toBe('function');
      expect(typeof tenant.setViewedRecords).toBe('function');
      expect(typeof tenant.clearViewedRecords).toBe('function');
    });
  });

  describe('switchToPublicContext', () => {
    it('should set context to public', () => {
      // Start with user context
      store.setState({
        tenant: {
          ...store.getState().tenant,
          context: { type: 'user' },
        },
      });

      store.getState().tenant.switchToPublicContext();

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({ type: 'public' });
    });
  });

  describe('switchToUserContext', () => {
    it('should set context to user', () => {
      store.getState().tenant.switchToUserContext();

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({ type: 'user' });
    });

    it('should switch from public to user', () => {
      expect(store.getState().tenant.context.type).toBe('public');

      store.getState().tenant.switchToUserContext();

      expect(store.getState().tenant.context.type).toBe('user');
    });
  });

  describe('switchToOrganizationContext', () => {
    it('should return false when organization does not exist', () => {
      const result = store.getState().tenant.switchToOrganizationContext('nonexistent-id');

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

      const result = store.getState().tenant.switchToOrganizationContext('org-1');

      expect(result).toBe(false);
    });

    it('should set context to organization when it exists', async () => {
      const { entity } = await buildOrganization({
        id: 'org-1',
        name: 'Test Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const mockOrg = entity.__serialize() as Organization;

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg },
        },
      });

      const result = store.getState().tenant.switchToOrganizationContext('org-1');

      expect(result).toBe(true);
      expect(store.getState().tenant.context).toEqual({
        type: 'organization',
        organization: mockOrg,
      });
    });
  });

  describe('switchToSpaceContext', () => {
    it('should return false when space does not exist', () => {
      const result = store.getState().tenant.switchToSpaceContext('nonexistent-id');

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

      const result = store.getState().tenant.switchToSpaceContext('space-1');

      expect(result).toBe(false);
    });

    it('should return false when organization for space does not exist', async () => {
      const { entity } = await buildSpace({
        id: 'space-1',
        name: 'Test Space',
        organizationId: 'org-1',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#000000',
      });
      const mockSpace = entity.__serialize() as Space;

      store.setState({
        auth: {
          ...store.getState().auth,
          spaces: { 'space-1': mockSpace },
          organizations: {},
        },
      });

      const result = store.getState().tenant.switchToSpaceContext('space-1');

      expect(result).toBe(false);
    });

    it('should set context to space when it and its organization exist', async () => {
      const { entity: orgEntity } = await buildOrganization({
        id: 'org-1',
        name: 'Test Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const mockOrg = orgEntity.__serialize() as Organization;
      const { entity: spaceEntity } = await buildSpace({
        id: 'space-1',
        name: 'Test Space',
        organizationId: 'org-1',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#000000',
      });
      const mockSpace = spaceEntity.__serialize() as Space;

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg },
          spaces: { 'space-1': mockSpace },
        },
      });

      const result = store.getState().tenant.switchToSpaceContext('space-1');

      expect(result).toBe(true);
      expect(store.getState().tenant.context).toEqual({
        type: 'space',
        organization: mockOrg,
        space: mockSpace,
      });
    });
  });

  describe('setViewedRecords and clearViewedRecords', () => {
    it('should set viewed records', async () => {
      const { entity } = await buildOrganization({
        id: 'org-1',
        name: 'Page Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const mockOrg = entity.__serialize();
      const viewedRecords = { organization: mockOrg };

      store.getState().tenant.setViewedRecords(viewedRecords);

      expect(store.getState().tenant.viewedRecords).toEqual(viewedRecords);
    });

    it('should clear viewed records', async () => {
      // Set some viewed records first
      const { entity } = await buildOrganization({
        id: 'org-1',
        name: 'Page Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const mockOrg = entity.__serialize();
      store.setState({
        tenant: {
          ...store.getState().tenant,
          viewedRecords: { organization: mockOrg },
        },
      });

      store.getState().tenant.clearViewedRecords();

      expect(store.getState().tenant.viewedRecords).toEqual({});
    });

    it('should preserve tenant context when setting viewed records', async () => {
      const { entity: orgEntity } = await buildOrganization({
        id: 'org-1',
        name: 'Test Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const mockOrg = orgEntity.__serialize();

      store.setState({
        auth: {
          ...store.getState().auth,
          organizations: { 'org-1': mockOrg },
        },
      });

      store.getState().tenant.switchToOrganizationContext('org-1');
      const { entity: pageOrgEntity } = await buildOrganization({
        id: 'page-org-1',
        name: 'Page Org',
        deletedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const pageOrg = pageOrgEntity.__serialize();
      store.getState().tenant.setViewedRecords({ organization: pageOrg });

      const { tenant } = store.getState();
      expect(tenant.context).toEqual({
        type: 'organization',
        organization: mockOrg,
      });
      expect(tenant.viewedRecords).toEqual({ organization: pageOrg });
    });
  });
});
