/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export const securitySchemes = {
  userJwt: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'JWT of a signed-in person, returned by sign-in under `/api/auth` and sent as ' +
      '`Authorization: Bearer <jwt>`. Signed ES256 by this API (keys at `/api/auth/jwks`) or by the ' +
      'configured issuer (`AUTH_ISSUER`, keys at `AUTH_JWKS_URL`); `sub` is the user. With no `grant` ' +
      'claim it carries the full user; with a `grant` claim it carries the entitlements an approved ' +
      '`grantUserEntitlements` inquiry granted, capped by what the user holds. Sessions and cookies ' +
      'are never accepted. Operations under `/api/admin` additionally require the superadmin platform role.',
  },
  apiToken: {
    type: 'http',
    scheme: 'bearer',
    description:
      'API token minted at a token create endpoint, sent as `Authorization: Bearer <key>`. The token carries ' +
      'its owner, so it acts as that user, organization user or space user, with a role and entitlements ' +
      'capped by what the owner holds. An operation refuses it when the token lacks the action the ' +
      'operation checks. Operations that check a person-only action (token minting and editing, account and ' +
      'organization deletion) list only `userJwt`: no API token holds those actions, though a ' +
      "superadmin's token passes every check.",
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
