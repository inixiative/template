# Flows

<!-- toc:start -->

## Contents

- [Purpose](#purpose)
- [Model](#model)
- [API](#api)
  - [Advance](#advance)
- [Client](#client)
  - [Navigation policies](#navigation-policies)
- [Flow-aware buttons](#flow-aware-buttons)
- [What flows are not](#what-flows-are-not)
- [Source map](#source-map)

<!-- toc:end -->

## Purpose

A flow takes one user through an ordered set of pages and brings them back to where they started.
Each step is a URL. The user consumes the flow: a button that completes the work on a step moves
them to the next step, and finishing or canceling returns them to the page that started the flow.

The canonical use: from Archives → Provision, the user needs a hosting integration first. The page
starts a flow whose first step is Integrations → Connect Railway and whose last step is back on
Archives with Railway preselected. Nothing on the Integrations page knows it is inside a flow; its
primary "Connect" button is flow-aware by default.

Flows come from the Carde.io organized-play MVP (`Flow` + `FlowStep`, `PUT /flows/:id/advance`).
The template adds the owner, cancel, an end-of-flow guard, safe concurrent advance, the client and
flow-aware buttons.

## Model

`packages/db/prisma/schema/flow.prisma`

| Model | Field | Meaning |
|---|---|---|
| `Flow` | `userId` | The person consuming the flow. Only they can read, advance or cancel it. |
| | `returnUrl` | The page that started the flow. Cancel and finish go here. Immutable. |
| | `currentStep` | `order` of the step the user is on. Equals the step count once complete. |
| | `completedAt` / `canceledAt` | Terminal states. At most one is set. |
| `FlowStep` | `order` | Position, from 0. `@@unique([flowId, order])`. |
| | `label`, `url`, `data` | What the banner shows, where the step lives, and anything the step's page needs (`{ provider: 'railway' }`). Immutable. |
| | `completedAt` | Set when the user advances past the step. |

Steps never change after creation: there is no step update or delete route, and
`ImmutableFieldsOverrides` strips `order`, `label`, `url` and `data` from any update (and
`returnUrl` on the flow). Step URLs and `returnUrl` must be paths inside the app (`/…`, not
`//host` or an absolute URL), so a flow can never send a user off-site.

Flows are not audit-enabled and not soft-deleted. They are ephemeral navigation state, like
`Session` and `Token`: progress is not a change worth an audit row, and canceling is a state
(`canceledAt`), not a delete. They are in `HARD_DELETE_ON_TOMBSTONE`, so a flow and its steps die
with their user.

## API

| Method | Path | Permission | Body | Notes |
|---|---|---|---|---|
| POST | `/me/flows` | the user | `{ returnUrl, flowSteps: [{ label, url, data? }] }` | 1–50 steps; `order` is the array index |
| GET | `/flow/:id` | `read` | | Steps ordered by `order` |
| POST | `/flow/:id/advance` | `operate` | `{ currentStep }` | Completes that step; see below |
| POST | `/flow/:id/cancel` | `operate` | | Returns the flow, carrying `returnUrl` |

Permissions are `ownerActions(['user'])` in the rebac schema: another user's flow is a 403. A
read-only token can read a flow but not move it.

### Advance

The body names the step being completed. Under a `db.findForUpdate` row lock:

- `currentStep` below the flow's current step: already done. The flow is returned unchanged
  (200). This makes a double click, a retry or two tabs safe: the step is completed once.
- the flow is canceled or complete: 409.
- `currentStep` ahead of the flow's current step: 409. Steps are not skipped.
- otherwise the step gets `completedAt`, `currentStep` moves on, and completing the last step sets
  the flow's `completedAt`.

Cancel takes the same lock. Canceling twice returns the canceled flow; canceling a completed flow
is a 409.

## Client

The flow id rides in the URL as the `flow` search param, so a flow survives a refresh and opens in a
new tab.

| Piece | Location | Role |
|---|---|---|
| `FlowProvider` | `components/flows/FlowProvider.tsx` | Reads `?flow=`, loads the flow, provides its controller. Mounted by `AppShell` and `FullscreenLayout`. |
| `FlowBanner` | `components/flows/FlowBanner.tsx` | "Step 2 of 3 · label", a progress bar and Cancel. Mounted by both layouts; renders nothing outside an active flow. |
| `useFlow()` | `hooks/flow/useFlow.ts` | `{ flow, currentFlowStep, isActive, advance(), cancel() }`, or `null` outside a flow. |
| `useStartFlow()` | `hooks/flow/useStartFlow.ts` | `startFlow({ flowSteps, returnUrl? })` creates the flow and opens step 1 with `?flow=`. `returnUrl` defaults to the current page. |

`advance()` sends the step it is on, navigates to the next step's url with `navigatePreserving(url,
'flow')`, and on the last step goes to `returnUrl` with `'context'`, which drops the flow param.
Concurrent calls share one request. `cancel()` goes to `returnUrl` the same way.

Finishing goes to `returnUrl`, not the last step's url. When the starting page needs something back
(preselect Railway), make that page the last step and put it in the step's `data`:

```tsx
const { startFlow } = useStartFlow();

startFlow({
  returnUrl: '/archives',
  flowSteps: [
    { label: 'Connect Railway', url: '/settings/integrations?connect=railway' },
    { label: 'Provision an archive', url: '/archives?provision=1', data: { provider: 'railway' } },
  ],
});

// on /archives
const flow = useFlow();
const provider = flow?.currentFlowStep?.data.provider;
```

### Navigation policies

`navigatePreserving(to, policy)` takes a `'flow'` policy beside `'context'`, `'spoof'` and `'all'`:
`'flow'` keeps `org`, `space` and `flow`; `'context'` keeps `org` and `space` and drops `flow`.
The sidebar and breadcrumbs use `'context'`, so leaving a flow's pages through them leaves the flow
(no banner, no flow-aware buttons). The flow itself stays open and can be resumed by its URL.

## Flow-aware buttons

Buttons are flow-aware by default, so a page does nothing to take part in a flow.

A `Button` **completes** a step when it is `type="submit"` or the primary (`default`) variant.
`secondary`, `ghost`, `outline`, `link` and `destructive` are neutral. `flow={false}` exempts a
completing button; `flow="complete"` opts a neutral one in.

Inside an active flow, a completing button's `onClick` runs as before. If it returns a promise and
the promise resolves, the flow advances and navigates. Two rules keep this safe:

- **Only a resolved promise advances.** A synchronous handler (opening a modal, toggling state)
  never advances, and neither does a rejected one. Return the mutation's promise
  (`mutateAsync`) to make an action complete a step.
- **Outside an active flow nothing changes.** No `FlowProvider`, no `?flow=`, or a finished flow:
  the button is the same button.

Submits go through `Form` (`components/primitives/Form.tsx`), a `<form>` whose `onSubmit` may
return a promise. When it resolves inside an active flow, the flow advances unless the submitting
button is exempt (`flow={false}`, rendered as `data-flow="neutral"`). A plain `<form>` is not
flow-aware.

`Link` (`components/primitives/Link.tsx`) keeps the `flow` param (and `org` / `space`) in both its
`href` and its navigation; `flow={false}` drops it.

## What flows are not

- **Not login.** Auth keeps its own `redirectTo`: login happens before there is a user to own a
  flow.
- **Not a wizard engine.** Steps hold no form state and no branching; a step's page does its own
  work. A different path is a different flow.
- **Not server-side side effects.** Advancing records progress only. The step's own action (the
  connect, the provision) does the work.

## Source map

- Schema: `packages/db/prisma/schema/flow.prisma`; factories `flowFactory.ts`, `flowStepFactory.ts`
- API: `apps/api/src/modules/flow/` and `apps/api/src/modules/me/*/meCreateFlow.ts`
- Permissions: `'db:flow'` in `packages/permissions/src/rebac/schema.ts`
- Client: `packages/ui/src/components/flows/`, `packages/ui/src/hooks/flow/`,
  `packages/ui/src/lib/flows/`, `packages/ui/src/lib/resolveNavigationTarget.ts`
- Primitives: `Button.tsx`, `Form.tsx`, `Link.tsx` in `packages/ui/src/components/primitives/`
- Tests: `apps/api/src/modules/flow/tests/flow.test.ts`,
  `packages/ui/src/components/flows/flowAwareness.test.tsx`
