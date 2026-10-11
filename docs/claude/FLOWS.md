# Flows

<!-- toc:start -->

## Contents

- [Purpose](#purpose)
- [Lineage](#lineage)
- [Definitions](#definitions)
  - [Validation](#validation)
- [Evaluation](#evaluation)
- [Instance](#instance)
- [API](#api)
- [Client](#client)
- [Example: `setUpOrganization`](#example-setuporganization)
- [What flows are not](#what-flows-are-not)
- [Source map](#source-map)

<!-- toc:end -->

## Purpose

A flow takes one user through an ordered set of steps across pages and brings them back to where
they started. Flows are predefined in code. The server decides when a step is done, from the same
data the user's own API calls would return. Pages and buttons need no flow-specific code.

The canonical use: from Archives → Provision, the user needs a hosting integration first. The page
starts a flow whose first step is Integrations `#connect-railway`. The step completes when the
user's integrations include Railway, and then the user is sent back to Archives with Railway
preselected.

## Lineage

The Carde.io organized-play MVP had two pieces of this:

- **The flow table.** `Flow { currentStep, complete }` and `FlowStep { order, label, url, data }`,
  advanced by `PUT /flows/:id/advance`.
- **Onboarding steps.** The Phoenix app's `OnboardingStep` had `include(user, game)` and
  `accomplished(user, game)` functions, evaluated on the client.

Template keeps the per-user instance and its `currentStep`. The steps move into a code registry,
and `accomplished` becomes data: a json-rules condition over a readMany route. The server
evaluates it as the user, so no client can advance a flow by claiming a step is done.

## Definitions

`apps/api/src/modules/flow/definitions/`. This follows the inquiry handler pattern: a Prisma enum
(`FlowKey`) and a `Record<FlowKey, FlowDefinition>`, with one folder per flow holding its definition
and its `paramsSchema`.

```ts
type FlowDefinition = {
  key: FlowKey;
  paramsSchema: z.ZodObject<…>;
  steps: FlowStepDefinition[];
};

type FlowStepDefinition = {
  key: string;
  label: string;
  url: string;
  mode: 'navigate' | 'anchor' | 'action';
  completedWhen: {
    read: string;
    path?: Record<string, string>;
    where?: Condition;
    count?: { atLeast: number };
  };
};
```

The fields:

- **`read`**: the SDK operationId of a paginated readMany route that has a `filterLens`.
- **`path`**: fills that route's path params. `{{param}}` takes a value from the flow's params.
- **`where`**: a json-rules condition over that route's `filterLens`. A leaf can `bind` a flow param,
  `flowStartedAt` or `userId`.
- **`count`**: how many rows must match. The default is `{ atLeast: 1 }`.
- **`url`**: where the step lives. It also takes `{{param}}`.
- **`mode`**: what the client does when the step becomes current:
  - `navigate` goes to `url`.
  - `anchor` goes to `url`. When that is the current page, only the hash changes, and the page
    opens or scrolls to that section.
  - `action` stays put; the work happens on the current page.

### Validation

Definitions are checked at boot (`app.ts`) and in `flowDefinitionIssues.test.ts`. A bad definition
fails boot and the test suite; it never reaches a user. For each step:

- `read` names a registered route (the route index is filled by `autoRegisterRoutes`), and that
  route is a paginated `GET` readMany with a `filterLens`.
- `path` fills exactly the route's path params.
- Every `{{param}}` in `url` and `path` is a key of `paramsSchema`, and every `bind` in `where` is a
  param, `flowStartedAt` or `userId`.
- `where` passes `validateRuleInLens` against the route's `filterLens`, so it reads only fields that
  route lets a caller filter on.
- `count.atLeast` is a positive integer.

## Evaluation

`POST /flow/:id/check` locks the flow (`db.findForUpdate`) and evaluates the current step. It
advances while each next step's rule holds, possibly through several steps, and sets `completedAt`
after the last one.

A step's rule is evaluated by running its bound route as the caller. `countFlowStepRows` resolves
the operationId and path with `resolveOperation`, the same helper the WebSocket layer uses. It then
calls the route through the batch sub-request machinery (`registerBatch` + `x-batch-id`), the way
`/batch` runs its sub-requests:

- **Identity.** The sub-request inherits the caller's identity: user, token and spoof. Its
  permissions are rebuilt from them, exactly as for a batch sub-request.
- **Middleware.** Every middleware the route declares runs, for example
  `validatePermission('manage')` on `organizationSentManyInquiries`.
- **Scoping.** The controller's parent scoping, `paginate`, the route's `filterLens` and
  `lensWhere` all run unchanged.
- **The flow's condition.** `where` is the one addition. It rides on the batch context as a
  narrowing, and `filterLensSetter` stacks it on the route's lens as one more layer, the same
  mechanism `scopeNarrowing` uses. A narrowing layer only narrows.
- **The count.** It is the route's own `pagination.total` (`pageSize=1`).

If the route refuses (403, 404), the step does not hold. If it refuses the first step at start,
`POST /me/flows` answers 403.

Completion therefore sees exactly what the SDK call would return. Permissions and tenancy cannot
drift, because there is no second implementation of them.

**Why not a lens over the owner's data, or a refactored query builder?** A hand-built lens
re-derives scoping that each route already encodes, and the two drift. The base `where` lives in
each controller, so factoring readMany would mean changing every controller. Calling the route
reuses all of it unchanged, and the batch registry already exists to call a route as its caller.

## Instance

`packages/db/prisma/schema/flow.prisma`

| Field | Meaning |
|---|---|
| `userId` | The person on the flow. Only they can read, check or cancel it. |
| `flowKey` | The registry entry. Immutable. |
| `params` | Bound at start and validated against the flow's `paramsSchema` (`{ organizationId }`). Immutable. |
| `returnUrl` | The page that started the flow. Cancel and finish go here. App paths only. Immutable. |
| `currentStep` | Index of the step the user is on. Equals the step count once complete. |
| `completedSteps` | `[{ stepKey, completedAt }]`, appended when a step completes. |
| `completedAt` / `canceledAt` | Terminal states. |

**Per-step completion is stored as `completedSteps` on the instance, not as an event table.**
Completion is written once, in order, under the flow's row lock, together with `currentStep`. One
row keeps that atomic and makes reads a single row with no join. The history a table would give is
already available: actions taken on a step are audit-logged by their own models, and app events
carry the rest.

**Not audit-enabled and not soft-deleted.** A flow is ephemeral navigation state, like `Session`
and `Token`. It is in `HARD_DELETE_ON_TOMBSTONE`, so it is deleted with its user.

## API

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/me/flows` | the user | `{ flowKey, params, returnUrl }`. `params` failing `paramsSchema` is a 400. Steps that already hold complete at once. |
| GET | `/flow/:id` | `read` | Never advances. Includes `progress` for the current step. |
| POST | `/flow/:id/check` | `operate` | Evaluates and advances. |
| POST | `/flow/:id/cancel` | `operate` | Returns the flow, carrying `returnUrl`. A completed flow is a 409. |

Responses carry:

- `flowSteps`: `[{ key, label, url, mode, completedAt }]`, with urls filled from params;
- `progress`: `{ count, required }` for the current step.

There is no client-driven advance. The server decides.

## Client

The flow id rides in the URL as `?flow=`. `FlowProvider` and `FlowBanner` are mounted by `AppShell`
and `FullscreenLayout`.

- `useFlow()` returns `{ flow, currentFlowStep, isActive, check(), cancel() }`, or `null`.
- `useStartFlow()` provides `startFlow({ flowKey, params, returnUrl? })`. It creates the flow and
  enters its current step. `returnUrl` defaults to the current page.
- **After any successful mutation**, while a flow is active, the provider calls `check()`. It
  subscribes to React Query's mutation cache, so every `useMutation` and `useOptimisticMutation`
  takes part without page code. The flow's own requests are tagged `meta.flowMutation` and never
  trigger a check. Concurrent triggers share one request and re-run once if more work landed
  meanwhile.
- **When a check advances**, the client enters the new current step by its `mode`. On the last step
  it goes to `returnUrl`. A check that doesn't advance changes nothing on screen except the banner's
  "1 of 2".
- **Navigation never advances.** Back, forward, links and reloads don't check anything; only a
  successful mutation does.
- **Anchors.** Pages read the hash with `useHashSection(id)`, which returns `[open, setOpen]` tied
  to `#id`. `OrganizationUsersPage` opens its invite modal on `#invite`, and `TokensPage` opens its
  create modal on `#create-token`.
- **`Link`** keeps `?flow=` (plus `org` / `space`) while a flow is active. The `'flow'` navigation
  policy does the same for `navigatePreserving`. The sidebar and breadcrumbs use `'context'`, so
  leaving a flow's pages through them drops it.

Buttons are plain buttons. They no longer decide completion.

## Example: `setUpOrganization`

`apps/api/src/modules/flow/definitions/setUpOrganization/`, params `{ organizationId }`:

| Step | Mode | Bound read | Completes when |
|---|---|---|---|
| Invite a teammate | navigate `/users/members?org=…` | `organizationSentManyInquiries` | ≥ 1 sent `inviteOrganizationUser` |
| Invite one more | anchor `#invite` | same | ≥ 2 |
| Create two API tokens | navigate `/settings/tokens?org=…#create-token` | `organizationReadManyTokens` | ≥ 2 |

`organizationSentManyInquiries`' `filterLens` does not show `createdAt`, so this flow counts
invitations sent before it started too. That is the lens doing its job: a rule can't read what the
route doesn't expose.

## What flows are not

- **Not login.** Auth keeps its own `redirectTo`.
- **Not a write path.** Checking only reads; the step's own page does the work.
- **Not a wizard engine.** There is no branching and no form state.

## Source map

- Schema: `packages/db/prisma/schema/flow.prisma`; factory `flowFactory.ts`
- Registry: `apps/api/src/modules/flow/definitions/`
- Validation: `apps/api/src/modules/flow/validations/flowDefinitionIssues.ts`; route index
  `apps/api/src/lib/routeTemplates/routeIndex.ts`
- Evaluation: `services/countFlowStepRows.ts`, `services/advanceSatisfiedSteps.ts`; batch narrowing in
  `modules/batch/services/batchRegistry.ts`, `middleware/prepareRequest.ts`,
  `lib/routeTemplates/utils/prepareMiddleware.ts`
- Client: `packages/ui/src/components/flows/`, `packages/ui/src/hooks/flow/`,
  `packages/ui/src/hooks/useHashSection.ts`, `packages/ui/src/lib/flows/`
- Tests: `apps/api/src/modules/flow/tests/`, `packages/ui/src/components/flows/flowClient.test.tsx`
