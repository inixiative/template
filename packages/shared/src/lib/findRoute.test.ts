import { describe, expect, it } from 'vitest';
import type { NavConfig } from '@template/ui';
import { findRoute, findRouteAcrossContexts } from './findRoute';

describe('findRoute', () => {
  const mockNavConfig: NavConfig = {
    personal: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Settings', path: '/settings' },
    ],
    organization: [
      { label: 'Dashboard', path: '/dashboard' },
      {
        label: 'Events',
        path: '/events',
        items: [
          {
            label: 'Event',
            path: '/:id',
            items: [
              { label: 'Edit', path: '/edit' },
              { label: 'Attendees', path: '/attendees' },
            ],
          },
          { label: 'Create Event', path: '/new' },
        ],
      },
      { label: 'Settings', path: '/settings' },
    ],
    space: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Customers', path: '/customers' },
    ],
    public: [{ label: 'Login', path: '/login' }],
  };

  it('should find exact path match', () => {
    const match = findRoute('/dashboard', mockNavConfig, 'personal');

    expect(match).not.toBeNull();
    expect(match?.item.label).toBe('Dashboard');
    expect(match?.fullPath).toBe('/dashboard');
    expect(match?.params).toEqual({});
    expect(match?.chain).toHaveLength(1);
  });

  it('should find nested route', () => {
    const match = findRoute('/events/new', mockNavConfig, 'organization');

    expect(match).not.toBeNull();
    expect(match?.item.label).toBe('Create Event');
    expect(match?.fullPath).toBe('/events/new');
    expect(match?.chain).toHaveLength(2);
    expect(match?.chain[0].label).toBe('Events');
    expect(match?.chain[1].label).toBe('Create Event');
  });

  it('should extract path parameters', () => {
    const match = findRoute('/events/abc123', mockNavConfig, 'organization');

    expect(match).not.toBeNull();
    expect(match?.item.label).toBe('Event');
    expect(match?.fullPath).toBe('/events/:id');
    expect(match?.params).toEqual({ id: 'abc123' });
    expect(match?.chain).toHaveLength(2);
  });

  it('should match deeply nested routes with params', () => {
    const match = findRoute('/events/abc123/edit', mockNavConfig, 'organization');

    expect(match).not.toBeNull();
    expect(match?.item.label).toBe('Edit');
    expect(match?.fullPath).toBe('/events/:id/edit');
    expect(match?.params).toEqual({ id: 'abc123' });
    expect(match?.chain).toHaveLength(3);
    expect(match?.chain[0].label).toBe('Events');
    expect(match?.chain[1].label).toBe('Event');
    expect(match?.chain[2].label).toBe('Edit');
  });

  it('should return null for non-existent route', () => {
    const match = findRoute('/non-existent', mockNavConfig, 'personal');
    expect(match).toBeNull();
  });

  it('should return null when path exists in different context', () => {
    const match = findRoute('/customers', mockNavConfig, 'personal');
    expect(match).toBeNull();
  });
});

describe('findRouteAcrossContexts', () => {
  const mockNavConfig: NavConfig = {
    personal: [{ label: 'Dashboard', path: '/dashboard' }],
    organization: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Settings', path: '/settings' },
    ],
    space: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Customers', path: '/customers' },
    ],
    public: [{ label: 'Login', path: '/login' }],
  };

  it('should find route in current context first', () => {
    const result = findRouteAcrossContexts('/dashboard', mockNavConfig, 'organization');

    expect(result).not.toBeNull();
    expect(result?.contextType).toBe('organization');
    expect(result?.match.item.label).toBe('Dashboard');
  });

  it('should fallback to less specific context', () => {
    const result = findRouteAcrossContexts('/settings', mockNavConfig, 'space');

    expect(result).not.toBeNull();
    expect(result?.contextType).toBe('organization');
    expect(result?.match.item.label).toBe('Settings');
  });

  it('should not fallback when starting from public (least specific)', () => {
    // Public is the least specific context - no fallback available
    const result = findRouteAcrossContexts('/dashboard', mockNavConfig, 'public');

    // /dashboard doesn't exist in public nav, and public has no fallback
    expect(result).toBeNull();
  });

  it('should find public route when starting from public', () => {
    const result = findRouteAcrossContexts('/login', mockNavConfig, 'public');

    expect(result).not.toBeNull();
    expect(result?.contextType).toBe('public');
    expect(result?.match.item.label).toBe('Login');
  });

  it('should return null when route does not exist in any context', () => {
    const result = findRouteAcrossContexts('/non-existent', mockNavConfig, 'organization');
    expect(result).toBeNull();
  });

  it('should skip more specific contexts when starting from org', () => {
    // Starting from org should not check space (more specific)
    const result = findRouteAcrossContexts('/customers', mockNavConfig, 'organization');
    expect(result).toBeNull();
  });
});
