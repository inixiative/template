import { describe, expect, it, vi } from 'vitest';
import { checkContextPermission } from './checkContextPermission';
import type { TenantContext } from '../store/slices/tenant';

describe('checkContextPermission', () => {
  const mockPermissions = {
    check: vi.fn(),
    isSuperadmin: vi.fn(() => false),
  };

  const mockNavConfig = {
    personal: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Settings', path: '/settings' },
    ],
    organization: [
      { label: 'Dashboard', path: '/dashboard' },
      {
        label: 'Settings',
        path: '/settings',
        access: (p: any, ctx: any) => p.check('organization', ctx.organization, 'manage'),
      },
    ],
    space: [
      { label: 'Dashboard', path: '/dashboard' },
      {
        label: 'Settings',
        path: '/settings',
        access: (p: any, ctx: any) => p.check('space', ctx.space, 'manage'),
      },
    ],
    public: [],
  };

  it('should allow access to personal settings', () => {
    const context: TenantContext = {
      type: 'personal',
    };

    const result = checkContextPermission({
      path: '/settings',
      permissions: mockPermissions as any,
      currentContext: context,
      navConfig: mockNavConfig,
    });

    expect(result).toEqual(context);
  });

  it('should check org permissions for org settings', () => {
    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    mockPermissions.check.mockReturnValue(true);

    const result = checkContextPermission({
      path: '/settings',
      permissions: mockPermissions as any,
      currentContext: context,
      navConfig: mockNavConfig,
    });

    expect(mockPermissions.check).toHaveBeenCalledWith('organization', context.organization, 'manage');
    expect(result).toEqual(context);
  });

  it('should handle context-aware routes (path + query params)', () => {
    // Path is always /settings, context comes from query params: /settings?org=abc-123
    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'abc-123', name: 'Test Org' },
    };

    mockPermissions.check.mockReturnValue(true);

    const result = checkContextPermission({
      path: '/settings', // Path is always the same, context from query params
      permissions: mockPermissions as any,
      currentContext: context,
      navConfig: mockNavConfig,
    });

    expect(mockPermissions.check).toHaveBeenCalledWith('organization', context.organization, 'manage');
    expect(result).toEqual(context);
  });

  it('should fallback to personal if org permission denied', () => {
    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    mockPermissions.check.mockReturnValue(false);

    const result = checkContextPermission({
      path: '/settings',
      permissions: mockPermissions as any,
      currentContext: context,
      organizations: [],
      navConfig: mockNavConfig,
    });

    expect(result).toEqual({
      type: 'personal',
      organization: undefined,
      space: undefined,
      personal: undefined,
    });
  });

  it('should return null if no context has permission', () => {
    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    mockPermissions.check.mockReturnValue(false);

    // Page that requires permissions in all contexts, all denied
    const result = checkContextPermission({
      path: '/admin-only-page',
      permissions: mockPermissions as any,
      currentContext: context,
      organizations: [],
      navConfig: {
        personal: [
          {
            label: 'Admin Only',
            path: '/admin-only-page',
            access: () => false, // Denied in personal too
          },
        ],
        organization: [
          {
            label: 'Admin Only',
            path: '/admin-only-page',
            access: () => false, // Always deny
          },
        ],
        space: [],
        public: [
          {
            label: 'Admin Only',
            path: '/admin-only-page',
            access: () => false, // Denied in public too
          },
        ],
      },
    });

    expect(result).toBeNull();
  });
});
