/**
 * @atlas
 * @partOf primitive:ui
 */
import { buildOrganizationUser, buildSpaceUser, buildUser } from '@template/db/test';
import { handlers as generatedHandlers } from '@template/ui/test/mocks/handlers.gen';
import { HttpResponse, http } from 'msw';

const customHandlers = [
  // Auth endpoints (BetterAuth, not in OpenAPI spec)
  http.post('*/auth/sign-in/email', async ({ request }) => {
    const body = await request.json();
    const { entity: user } = await buildUser({
      email: (body as { email: string }).email,
    });

    return HttpResponse.json({
      user,
      token: 'test-jwt',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  // Override /api/v1/me with realistic data
  http.get('*/api/v1/me', async () => {
    const { entity: user } = await buildUser({ platformRole: 'user' });
    const { entity: org } = await buildOrganizationUser({ userId: user.id });
    const { entity: space } = await buildSpaceUser({ userId: user.id });

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

export const handlers = [...customHandlers, ...generatedHandlers];
