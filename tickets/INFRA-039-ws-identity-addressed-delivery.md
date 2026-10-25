# INFRA-039 — WebSocket pushes addressed to an identity, not only a user

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Low · **Related:** #219 (actor, `/identify`), INFRA-038, AUTH-005

## Context

A socket receives two kinds of traffic:

- **Channels and streams** it subscribed to. Each is authorized by replaying its GET route with the
  socket's own credential (`canSubscribe`, `streamProbe`), so a token sees exactly what its claim
  reads. Streams are re-probed every 45s (`streamReauthorizeSweep.ts`); channels are not re-checked
  after subscribe.
- **Pushes addressed to a user**: an app event's websocket handoff targets `userIds`
  (`appEvents/channels/websocket.ts`), delivered through `sendToUser` → the `byUser` index of sockets
  keyed by `ws.data.userId` (`ws/identity.ts`, `ws/pubsub.ts`). `perRecipient` streams key their seq
  on the same `userId` (`ws/streamSeq.ts`).

Since #219, a socket's identity comes from `GET /identify` (the actor `{ model, record }` the rules
see), and `ws.data.userId` is set only when the actor is a `User` session. So:

- a token of an organization, space, seat or integration now authenticates a socket and subscribes
  to what its claim reads (it used to be dropped as anonymous);
- **a person's own User token no longer receives that person's pushes** (it used to, when identity
  came from `/me`). Today's only push is a `refetch` hint, so nothing is lost, but it is a gap.

Websockets are not only the frontend: agent sessions acting through an integration's token want
pushes too ("your job finished"), and today nothing can address them.

## The idea

Address a push to an identity, `{ model, id }` (the false-polymorphism shape), and register each
socket under every identity its credential **is**:

| Socket's credential | Addressable as |
|---|---|
| Session (JWT or spoof) | `User:u` |
| A person's own token | `Token:t`, `User:u` (the `me(c)` rule, `lib/context/me.ts`) |
| An integration's token | `Token:t`, `Integration:i` |
| A seat's / organization's / space's token | `Token:t` |

`sendToUser(userId)` becomes `sendTo({ model: 'User', id })`; the index is keyed `model:id`;
`perRecipient` seq keys on the recipient key. The `User` case reproduces today's behaviour and closes
the gap above.

### How granular? Identities, not audiences

Candidates are the owner models: User, Token, Integration, Organization, Space, OrganizationUser,
SpaceUser.

- **Go as far as identities a credential is: User, Token, Integration.** Each answers "is this socket
  that party?" without an authorization question: a socket either holds that credential or it does
  not.
- **Do not target Organization, Space or the seats.** "Everyone in org O" is an *audience*, not an
  identity: delivering it means deciding, at send time and with no route, which sockets may see O.
  That is what channels already do, with the route as the check and the sweep to revoke. A seat is
  ambiguous for a session, which acts as its person, not as one seat. If a sender wants "the admins
  of O", resolve them to users at send time (as webhook fan-out resolves parties) and address users.

## If the alternative is the full channel model

An adversarial pass (2026-10-26) on "make a user's pushes a `user:<id>` channel and drop `byUser`"
found it moves complexity rather than removing it:

- no `GET /user/:id` route exists to gate it, and "can read the user row" is the wrong gate (a
  superadmin passes every check and would receive anyone's pushes);
- pushes are `me`-relative keys (`refetch({ _id: 'meReadManySegmentMemberships' })`), wrong for any
  other subscriber;
- `perRecipient` streams need a recipient key, and channels need a recheck sweep before long-lived
  tokens subscribe to them.

Identity addressing keeps a server-side index and needs none of those.

## Definition of done

- [ ] App events address `{ model, id }` recipients; `userIds` targets keep working as `User`.
- [ ] A socket is indexed under each identity its credential is (table above), across instances.
- [ ] A person's own token receives that person's pushes; an integration's token receives pushes
      addressed to its integration; a seat/organization/space token receives only `Token:t`.
- [ ] `perRecipient` streams key on the recipient; existing shared streams unchanged.
- [ ] Channels are re-probed on the stream sweep's cadence (or one sweep for both), so a revoked
      token loses channels as it loses streams.
- [ ] WEBSOCKETS.md documents addressing vs. subscribing.
