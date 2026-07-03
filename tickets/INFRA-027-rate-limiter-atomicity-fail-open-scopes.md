# INFRA-027: Rate limiter — atomic fixed window, fail-open, hierarchical scopes

**Status**: 🆕 Not Started
**Assignee**: TBD
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

## Tasks

- [ ] Replace the two-command INCR/EXPIRE with the atomic `INCR_WITH_EXPIRY` eval in `apiRateLimit` and `rateLimit`
- [ ] Wrap the Redis call fail-open; `logger.warn` on unreachable and wire an alert on that warn
- [ ] Add `rateLimitPerSecond` to `Organization`; source the org `max` from it
- [ ] Make the token limiter (`apiRateLimit`) check actor AND organization scopes in one request, 429 on the first breach
- [ ] Tests: atomic window (a failure between commands can't strand a key), fail-open on Redis-down, per-scope breach (token over vs org over), org cap holds across multiple tokens

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
