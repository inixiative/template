import { http, HttpResponse } from 'msw';
import { buildUser, buildOrganizationUser, buildSpaceUser } from '@template/db/test';
import { handlers as generatedHandlers } from './handlers.gen';

/**
 * Custom MSW handlers that override generated defaults.
 * Generated handlers are in handlers.gen.ts (auto-generated from SDK).
 */
const customHandlers = [
  // Auth endpoints (BetterAuth, not in OpenAPI spec)
  http.post('*/api/auth/sign-out', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/auth/sign-in/email', async ({ request }) => {
    const body = await request.json();
    const user = buildUser({
      email: (body as any).email,
    });

    return HttpResponse.json({
      user,
      session: {
        id: 'session-123',
        userId: user.id,
        token: 'test-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }),

  // Override /api/v1/me with realistic data
  http.get('*/api/v1/me', () => {
    const user = buildUser({ platformRole: 'user' });
    const org = buildOrganizationUser({ userId: user.id });
    const space = buildSpaceUser({ userId: user.id });

    return HttpResponse.json({
      data: {
        ...user,
        organizationUsers: [
          {
            id: org.id,
            userId: user.id,
            organizationId: org.organizationId,
            role: org.role,
            entitlements: {},
          },
        ],
        organizations: [],
        spaceUsers: [
          {
            id: space.id,
            userId: user.id,
            spaceId: space.spaceId,
            organizationId: space.organizationId,
            role: space.role,
            entitlements: {},
          },
        ],
        spaces: [],
      },
    });
  }),
];

/**
 * Export custom handlers first, then generated ones.
 * MSW uses the first matching handler, so custom overrides take precedence.
 */
export const handlers = [...customHandlers, ...generatedHandlers];
