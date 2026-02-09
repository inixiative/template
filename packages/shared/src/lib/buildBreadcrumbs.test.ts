import { describe, expect, it } from 'vitest';
import type { RouteMatch } from './findRoute';
import type { TenantContext } from '../store/slices/tenant';
import { buildBreadcrumbs } from './buildBreadcrumbs';

describe('buildBreadcrumbs', () => {
  it('should build breadcrumbs without context params for personal context', () => {
    const match: RouteMatch = {
      item: { label: 'Settings', path: '/settings' },
      chain: [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
      ],
      fullPath: '/dashboard/settings',
      params: {},
    };

    const context: TenantContext = {
      type: 'personal',
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Settings', href: '/dashboard/settings' },
    ]);
  });

  it('should include org query param for organization context', () => {
    const match: RouteMatch = {
      item: { label: 'Settings', path: '/settings' },
      chain: [{ label: 'Settings', path: '/settings' }],
      fullPath: '/settings',
      params: {},
    };

    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([{ label: 'Settings', href: '/settings?org=org-123' }]);
  });

  it('should include space query param for space context', () => {
    const match: RouteMatch = {
      item: { label: 'Customers', path: '/customers' },
      chain: [{ label: 'Customers', path: '/customers' }],
      fullPath: '/customers',
      params: {},
    };

    const context: TenantContext = {
      type: 'space',
      space: { id: 'space-456', name: 'Test Space', organizationId: 'org-123' },
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([{ label: 'Customers', href: '/customers?space=space-456' }]);
  });

  it('should replace path params and use breadcrumbLabel', () => {
    const match: RouteMatch = {
      item: { label: 'Edit', path: '/edit' },
      chain: [
        { label: 'Events', path: '/events' },
        {
          label: 'Event',
          path: '/:id',
          breadcrumbLabel: (record) => record.name,
        },
        { label: 'Edit', path: '/edit' },
      ],
      fullPath: '/events/:id/edit',
      params: { id: 'abc123' },
    };

    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    const pageContext = {
      event: { id: 'abc123', name: 'Tech Conference' },
    };

    const breadcrumbs = buildBreadcrumbs(match, context, pageContext);

    expect(breadcrumbs).toEqual([
      { label: 'Events', href: '/events?org=org-123' },
      { label: 'Tech Conference', href: '/events/abc123?org=org-123' },
      { label: 'Edit', href: '/events/abc123/edit?org=org-123' },
    ]);
  });

  it('should use static label when breadcrumbLabel not provided', () => {
    const match: RouteMatch = {
      item: { label: 'Event', path: '/:id' },
      chain: [
        { label: 'Events', path: '/events' },
        { label: 'Event', path: '/:id' },
      ],
      fullPath: '/events/:id',
      params: { id: 'abc123' },
    };

    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([
      { label: 'Events', href: '/events?org=org-123' },
      { label: 'Event', href: '/events/abc123?org=org-123' },
    ]);
  });

  it('should use static label when pageContext missing', () => {
    const match: RouteMatch = {
      item: { label: 'Event', path: '/:id' },
      chain: [
        { label: 'Events', path: '/events' },
        {
          label: 'Event',
          path: '/:id',
          breadcrumbLabel: (record) => record.name,
        },
      ],
      fullPath: '/events/:id',
      params: { id: 'abc123' },
    };

    const context: TenantContext = {
      type: 'personal',
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([
      { label: 'Events', href: '/events' },
      { label: 'Event', href: '/events/abc123' },
    ]);
  });

  it('should handle multiple path params', () => {
    const match: RouteMatch = {
      item: { label: 'Attendee', path: '/:attendeeId' },
      chain: [
        { label: 'Events', path: '/events' },
        { label: 'Event', path: '/:eventId' },
        { label: 'Attendees', path: '/attendees' },
        { label: 'Attendee', path: '/:attendeeId' },
      ],
      fullPath: '/events/:eventId/attendees/:attendeeId',
      params: { eventId: 'evt-123', attendeeId: 'att-456' },
    };

    const context: TenantContext = {
      type: 'organization',
      organization: { id: 'org-123', name: 'Test Org' },
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([
      { label: 'Events', href: '/events?org=org-123' },
      { label: 'Event', href: '/events/evt-123?org=org-123' },
      { label: 'Attendees', href: '/events/evt-123/attendees?org=org-123' },
      { label: 'Attendee', href: '/events/evt-123/attendees/att-456?org=org-123' },
    ]);
  });

  it('should handle public context without query params', () => {
    const match: RouteMatch = {
      item: { label: 'Login', path: '/login' },
      chain: [{ label: 'Login', path: '/login' }],
      fullPath: '/login',
      params: {},
    };

    const context: TenantContext = {
      type: 'public',
    };

    const breadcrumbs = buildBreadcrumbs(match, context);

    expect(breadcrumbs).toEqual([{ label: 'Login', href: '/login' }]);
  });
});
