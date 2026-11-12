# INFRA-038 — WS channels carry a tenant only if a route resolves one outside its path

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Low · **Related:** Zealot ZLT-5670 (84703c9b14, 1d90165b6c)

## Context

Zealot added tenancy to WS channel names: `channelKey({ _id, path, brandUuid })` serializes it as
`?brandUuid=`, and `WS_CHANNELS` entries declare `isBrandScoped`. The subscribe probe sends
`x-brand-uuid`, and the controller's auth-probe short-circuit reports the brand the request resolved
in a response header. It reports it only when a brand user of that brand, or a superadmin, is acting.
The probe accepts only when that header matches the channel's brand.

Zealot needs it because its routes pick the tenant from a header (`allowBrandFromRequest`). For a
non-superadmin, that middleware ignores a foreign brand and does not reject it, so a 2xx probe alone
would let any brand user watch any brand's channel.

## Why it was not ported

The template's tenants (Organization, Space) come from the route path, through
`resourceContextMiddleware` and the ReBAC check on that resource. A channel's path already names the
tenant, and `canSubscribe` dry-runs the real route, so a 2xx already means the caller may read that
tenant's resource. No route here picks a tenant from a header and falls back silently, so there is
no gap to close. Adding `?organizationId=` would be a second spelling of something the path already
carries.

## When to do it

Do it when a route first resolves its tenant outside its path. Examples: a "current organization"
header, or a `/me/...` read scoped by session state. Port the Zealot shape, named after the tenant:

- `channelKey`/`parseChannelKey` keep one tenancy query param. A channel must round-trip to itself.
- A `WS_CHANNELS` entry declares that it is tenant-scoped. The probe requires the tenant exactly when
  the entry declares it.
- The probe sends the tenant header. `makeController`'s auth-probe branch reports the resolved tenant
  only for a member of it, or a superadmin. The probe compares that report, never the 2xx alone.
- `rollingCache.refreshed` already sends `parseChannelKey(channel)` as the refetch key. Drop the tenant
  from that key, because client query keys will not carry it.

## Definition of done

- [ ] A tenant-scoped channel cannot be subscribed with a foreign or missing tenant (probe tests)
- [ ] An existing path-scoped channel is unchanged
