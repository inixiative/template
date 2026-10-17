/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export const securitySchemes = {
  sessionToken: {
    type: 'http',
    scheme: 'bearer',
    description:
      'Session of a signed-in person, issued under `/api/auth`. Sent as `Authorization: Bearer <token>` ' +
      '(the session cookie set at sign-in is accepted the same way). Operations under `/api/admin` ' +
      'additionally require the superadmin platform role.',
  },
  apiToken: {
    type: 'http',
    scheme: 'bearer',
    description:
      'API token minted at a token create endpoint, sent as `Authorization: Bearer <key>`. The token carries ' +
      'its owner, so it acts as that user, organization user or space user, with a role and entitlements ' +
      'capped by what the owner holds. An operation refuses it when the token lacks the action the ' +
      'operation checks.',
  },
  userJwt: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'JWT signed by the configured issuer (`AUTH_ISSUER`, keys at `AUTH_JWKS_URL`). It is the user: with no ' +
      '`grant` claim it carries the full user, as a session does; with a `grant` claim it carries the entitlements ' +
      'an approved `grantUserEntitlements` inquiry granted, capped by what the user holds.',
  },
  internalSecret: {
    type: 'apiKey',
    in: 'header',
    name: 'x-internal-secret',
    description:
      'Shared secret for service-to-service calls under `/api/internal`. Not issued to API consumers.',
  },
} as const;

export type SecuritySchemeName = keyof typeof securitySchemes;

export const securityRequirements = (
  ...names: SecuritySchemeName[]
): NonNullable<RouteConfig['security']> => names.map((name) => ({ [name]: [] }));

export const registerSecuritySchemes = (app: OpenAPIHono<AppEnv>) => {
  for (const [name, scheme] of Object.entries(securitySchemes)) {
    app.openAPIRegistry.registerComponent('securitySchemes', name, scheme);
  }
};
