# INFRA-027: Rate limiter — atomic fixed window, fail-open, hierarchical scopes

**Status**: 🔄 In Progress (branch `INFRA-027-rate-limiter`)
**Assignee**: Aron
**Priority**: High
**Created**: 2026-07-03

> Surfaced reviewing Zealot PR #1611 (ZLT-3195, MCP transport) against `apps/api/src/middleware/rateLimit.ts`.
> Two hardening fixes flow consumer → template — atomic INCR+EXPIRE and fail-open on a limiter outage —
> plus one new design (hierarchical AND-checked scopes) and one guardrail (keep durable quota out).

---

## Problem

Today `apiRateLimit` / `rateLimit` do two round trips — `INCR` then a guarded `EXPIRE`:

```ts
const count = await redis.incr(redisKey);
if (count === 1) await redis.expire(redisKey, windowSec);
```

**1. Non-atomic — the load-bearing bug.** `INCR` and `EXPIRE` are separate commands. A crash, dropped
connection, or failover between them leaves the key holding a count with no TTL. It never expires, and
because the guard only fires at `count === 1`, `EXPIRE` is never retried — the counter climbs past `max`
and that identifier is wedged over-limit forever. The one-second window silently becomes permanent.
Folding the guarded EXPIRE into the same script also closes a drift risk: a later "simplify" that drops
the `count === 1` guard turns the fixed window into an unconditional per-request TTL refresh that never
closes under sustained traffic.

**2. Fail-closed.** There is no `try/catch`, so a Redis outage throws out of the middleware and every
guarded route 500s. A rate limiter is abuse protection, not an authz boundary — coupling API
availability to Redis health turns a limiter blip into a full API outage.

**3. Per-token only — a leaky bound.** The limit reads `token.rateLimitPerSecond` keyed on `token:{id}`.
An organization that wants N× throughput just mints N tokens; the per-token cap bounds nothing at the
tenant. `Organization` is the tenancy root (`Space.organizationId → Organization`, `onDelete: Cascade`;
`Token` carries `organizationId` / `spaceId` / `userId`), so the real budget lives one level up.

**4. Spoofable client IP — and it also poisons the audit trail.** The IP branch keys on `getClientIp`,
which reads `x-forwarded-for.split(',')[0]` — the leftmost hop, which is client-supplied. Behind an
appending reverse proxy the trustworthy IP is the rightmost hop the proxy added, not the first. As
written, anyone sets `X-Forwarded-For: <random>` per request and mints a fresh `ip:` bucket every time,
so the IP-keyed limiters (`authRateLimit`, `emailRateLimit`, and any future public-surface limiter) are
a no-op against a motivated caller. Worse, the same `getClientIp` feeds `auditActorMiddleware`
(`packages/db` exports `./lib/auditActorContext`), so the recorded actor IP is forgeable too — spoofed
provenance in the audit log. IPv6 compounds it: the key is a full /128, so a routine /64 rotates for free.

## Decision

- **Atomic INCR + EXPIRE-on-first via one Lua eval.** Port Zealot's `INCR_WITH_EXPIRY` — the TTL is set
  in the same round trip as the counter, only when the key is created:

  ```ts
  const INCR_WITH_EXPIRY = "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return c";
  const count = (await redis.eval(INCR_WITH_EXPIRY, 1, redisKey, String(windowSeconds))) as number;
  ```

  Correct fixed-window idiom: no stranded TTL-less key, no window-refresh drift.

- **Fail-open.** Wrap the Redis call; on anything that isn't the 429 itself, `logger.warn` and continue.
  Alert on that warn so a Redis-unreachable limiter surfaces without taking the API down with it.

  ```ts
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.warn('rateLimit: redis unavailable, allowing request', { key, err });
  }
  ```

- **Hierarchical, AND-checked scopes.** The token limiter checks every applicable scope in one pass —
  actor (`token:{id}`) AND organization (`org:{organizationId}`) — and 429s if any is over. Each scope
  sources its own `max` from its own entity: `Token.rateLimitPerSecond` for the actor, a new
  `Organization.rateLimitPerSecond` for the tenant. `Space` drops into the same AND-check as an optional
  middle tier if a per-space budget is ever wanted; the org ceiling is the one that closes the
  mint-more-tokens hole. One atomic eval per scope.

- **Quota stays out.** A monthly / per-org usage quota is durable billing metering — persisted,
  reconciled, and fail-*closed* (you don't give away metered usage on an outage). Opposite failure
  semantics from a per-second abuse limiter. Do not fold quota into this middleware; it belongs in
  metering.

- **Derive the client IP from the right, in one shared helper.** Parse `X-Forwarded-For` from the
  trusted end by the known proxy-hop count (or read the edge's `CF-Connecting-IP` / `True-Client-IP`
  where a CDN overwrites it) — never `[0]`. Mask to /64 for IPv6, /32 for IPv4. Fix it once in the
  shared `getClientIp` so both the limiter and `auditActorMiddleware` inherit a trustworthy value; the
  audit-actor spoof closes with the same change.

## Rulings (2026-09-17, supersede the Decision bullets where they differ)

- **Identity is the user.** A session and every token owned by or through a user (`User`, `OrganizationUser`,
  `SpaceUser` owner models) share one `user:{id}` bucket, so minting tokens buys nothing at the principal.
  `Organization` / `Space` owned tokens have no person behind them: the tenant is the principal.
  Anonymous requests key on the trusted client IP.
- **Context is the other axis.** An organization bucket and a space bucket, taken from the token's scope
  (`getActor`), AND-checked with the principal bucket. Space nests under organization. A session user acting
  in an org contributes to no org bucket in this cut — resource-derived context is a later seam, not a column.
- **Limits are entitlements, not columns.** No `rateLimitPerSecond` on Organization or Space; the existing
  column on Token is no longer read. Every max resolves through `rateLimitMax(tier, c)` — one stub with code
  defaults, to be fed by subscriptions / feature flags (FEAT-003) when they land. Token's column retires with
  that work.
- **Shape = Zealot's rule-array middleware** (`rateLimit(rules, { onLimited })`): scope + window + max (number
  or per-request fn) + key fn per rule; null key skips the rule; 429 through `makeError` with `Retry-After` and
  `Cache-Control: no-store` (`makeError` grew a `headers` option); fail-open on any Redis error with a warn and
  an `errorReporter` capture.
- **Batch sub-requests are not counted** (ruling 2026-09-17): the batch request paid once. The skip keys on the batch transaction prepareRequest resolves from the registry, since the `x-batch-id` header alone is spoofable.
- **Wired.** `apiRateLimit` (principal AND space AND organization, 1 s windows) on every route after auth in
  `routes/api.ts`; `authRateLimit` (per IP, 1 min) on `/api/auth/*`. `emailRateLimit` had no consumer and is gone.
- **`clientIp` / `clientAddress`.** Trusted right-most XFF hop; `clientIp` buckets IPv6 to /64 for limiting,
  `clientAddress` keeps the full address for `auditActorMiddleware`.

## Tasks

- [x] Atomic `INCR` + first-hit `PEXPIRE` Lua window (`incrementFixedWindows`, batch of windows per call)
- [x] Fail-open on Redis error: warn + `errorReporter.captureException`, request allowed
- [x] Rule-array `rateLimit` middleware, AND-checked, `Retry-After`, `onLimited` hook
- [x] Identities: `userIdentity` / `principalIdentity` / `organizationIdentity` / `spaceIdentity` / `ipIdentity` from `getActor`
- [x] `rateLimitMax(tier, c)` seam with code defaults (user 10/s, space 30/s, org 60/s, auth 60/min)
- [x] `clientIp` trusted-hop + /64 bucketing; `clientAddress` feeding `auditActorMiddleware`
- [x] Wire `apiRateLimit` after auth and `authRateLimit` on `/api/auth/*`
- [x] Tests: window count/ttl, 429 + `Retry-After` + envelope, `onLimited`, per-client isolation, AND rules, fn max, null-key skip, spoofed XFF, fail-open, identities per owner model
- [ ] Feed `rateLimitMax` from subscriptions / feature flags (FEAT-003) and drop `Token.rateLimitPerSecond`
- [ ] Resource-derived organization / space context for session users, if per-tenant fair share is wanted
- [ ] Alert on the fail-open warn
- [ ] Collapse a request's windows into one multi-key eval (one command instead of one per rule). Blocked on ioredis-mock, which returns `undefined` for any Lua table built by a loop that runs more than once; the per-window evals are still dispatched in one write.
- [x] Lua lives in `queries/` (`lanes/queries/`, `lock/queries/`, `rateLimit/queries/`), enforced by the `lua-in-queries` CI rule

---

## Resources

- Reference impl: Zealot PR #1611 (ZLT-3195) `apps/api/src/middleware/rateLimit.ts` — `INCR_WITH_EXPIRY`, fail-open, `mcpRateLimit`
- Template file: `apps/api/src/middleware/rateLimit.ts`
- Tenancy: `packages/db/prisma/schema/organization.prisma`, `space.prisma`, `token.prisma`

---

## Comments

_Consumer → template. The atomic eval and fail-open ship in Zealot PR #1611 and port straight back.
The hierarchical AND-check is new design surfaced by the same review — Zealot keys per-token-or-IP too,
so the org tier lands in the template first. Quota metering is deliberately out of scope here._
