# INFRA-040 — Every WebSocket delivery is a content channel

**Status:** 🆕 Not Started · **Line:** INFRA · **Priority:** Low · **Related:** #219 (actor, `/identify`), INFRA-038, AUTH-005

## Context

A socket receives two kinds of traffic today:

- **Channels and streams** it subscribed to, named by content (`inquiryRead:id:X`). Each is
  authorized by replaying its GET route with the socket's own credential (`canSubscribe`,
  `streamProbe`), so a token sees exactly what its claim reads. Streams are re-probed every 45s
  (`streamReauthorizeSweep.ts`); channels are not re-checked after subscribe.
- **Pushes addressed to a user**: an app event's websocket handoff targets `userIds`
  (`appEvents/channels/websocket.ts`), delivered through `sendToUser` → the `byUser` index of sockets
  keyed by `ws.data.userId` (`ws/identity.ts`, `ws/pubsub.ts`). `perRecipient` streams key their seq
  on the same `userId` (`ws/streamSeq.ts`).

Since #219, a socket's identity comes from `GET /identify`, and `ws.data.userId` is set only for a
`User` session. A token of an organization, space, seat or integration now authenticates a socket
and subscribes to what its claim reads; **a person's own token no longer receives that person's
user pushes**. Today's only push is a refetch hint, so nothing is lost, but it shows the seam.

## The idea: pushes are content too

A token, an agent session or a browser subscribes to *content*, never to an identity: it knows what
it wants to hear about (an inquiry, a list, a job), not anyone's token id. The user pushes are
content in disguise. The only one today, `refetch({ _id: 'meReadManySegmentMemberships' })` sent to
a user id, means "this person's segment memberships changed", and that content has a route:
`GET /user/:id/segmentMemberships` (`userReadManySegmentMemberships`).

So every delivery is a channel named by its content:

- **send**: the event publishes to the content's channel (`userReadManySegmentMemberships:id:u`),
  not to recipients;
- **receive**: whoever's credential the route lets read it subscribes: the person's session, their
  own token within its claim, an admin tool. A seat's token cannot read it, so it never gets it.

This removes `sendToUser`, the `byUser` index, `ws.data.userId`, the pubsub `'user'` message and the
`me`-relative push keys. There is one delivery rule (subscribe to content; the route authorizes) and
no "whom to address" question.

### Why not address identities (User / Token / Integration / org / seat)?

Considered and dropped (2026-10-26). Addressing a recipient means the sender must know who should
hear, and an organization, space or seat target is an audience decided at send time with no route.
Content channels already express both "this party's things" (a channel on that party's content) and
audiences (whoever can read it). Even "your job finished" is the job record changing: a channel on
the job. Identity addressing is only worth revisiting for a message that is about no content at all.

An earlier variant, a bare `user:<id>` channel, was rejected by an adversarial pass: no route gates
it, "can read the user row" lets a superadmin hear anyone, and its pushes were `me`-relative. A
channel on real content has a route, a non-`me` key, and an audience that is exactly who may read it.

## What it takes

- Each app event that pushes to users publishes to the content channel instead; the channel's route
  must exist (add the GET where it does not).
- `WS_CHANNELS` entries for those routes; `meReadMany…` push keys become the content's keys.
- The frontend subscribes to the content channels it shows (a hook keyed on the record it renders,
  e.g. `me.id` for the person's own lists), rather than relying on implicit per-user delivery. On
  logout / spoof, the client re-subscribes for the new person instead of trusting replay.
- `perRecipient` streams become streams named by their content (`…:id:u`), audience `shared`; the
  route authorizes them like any stream, and the seq key no longer needs a user.
- Channels are re-probed on a sweep like streams (one sweep for both, a single interval), so a
  revoked token or demoted seat loses channels as it loses streams.

## Definition of done

- [ ] No delivery path addresses a user id: `sendToUser`, `byUser`, `ws.data.userId` and the pubsub
      `'user'` message are gone.
- [ ] The segment-membership refetch publishes to `userReadManySegmentMemberships:id:<user>`; the
      person's session and own token receive it, a seat token cannot subscribe.
- [ ] `perRecipient` is gone; the contacts stream (and any new stream) is named by content.
- [ ] One recheck sweep covers channels and streams; a revoked token loses both within an interval.
- [ ] WEBSOCKETS.md: everything a socket receives is content it subscribed to, authorized by the
      content's route.
