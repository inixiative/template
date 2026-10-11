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
data the user's own API reads return. Pages and buttons need no flow-specific code.

The canonical use is Kingdom's Archives → Provision. The user needs a hosting integration first, so
the page starts a flow:

1. The first step sends the user to Integrations.
2. That step completes once one of the owner's enabled integrations is Railway or Render.
3. The user returns to Archives.

**Flows add no expression language.** Everything in a definition is an existing piece:

- json-rules conditions and their `{ bind }` tokens (`bindRule`, `listBindings`), including
  `ArrayOperator.atLeast` for counts;
- SDK operationIds and the SDK's `{ path, query }` call shape;
- TanStack Router's own `{ to, params, search, hash }`.

## Lineage

The Carde.io organized-play MVP had two pieces of this:

- **The flow table.** `Flow { currentStep, complete }` and `FlowStep { order, label, url, data }`,
  advanced by `PUT /flows/:id/advance`.
- **Onboarding steps.** The Phoenix app's `OnboardingStep` had `include(user, game)` and
  `accomplished(user, game)` functions, evaluated on the client.

Template keeps the per-user instance and `currentStep`. The steps move into a code registry, and
`accomplished` becomes data: a json-rules rule over what an API read returns to the user. The
server evaluates it, so no client can advance a flow by claiming a step is done.

## Definitions

`apps/api/src/modules/flow/definitions/`. This follows the inquiry handler pattern: a Prisma enum
(`FlowKey`) and a `Record<FlowKey, FlowDefinition>`, with one folder per flow holding its
definition and its `bindingsSchema`.

```ts
type FlowBind = { bind: string };

type FlowDefinition = {
  key: FlowKey;
  bindingsSchema: z.ZodObject<…>;
  steps: FlowStepDefinition[];
};

type FlowStepDefinition = {
  key: string;
  label: string;
  mode: 'navigate' | 'anchor' | 'action';
  to: string;
  params?: Record<string, FlowBind>;
  search?: Record<string, FlowBind>;
  hash?: string;
  completedWhen: {
    read: string;
    path?: Record<string, FlowBind>;
    query?: Record<string, FlowBind>;
    rule: Condition;
  };
};
```

**Bindings.** A flow is started with `bindings` (for example `{ organizationId }`), validated
against its `bindingsSchema`. Two bindings are always present: `flowStartedAt` and `userId`. Every
`{ bind }`, in a rule, a `path`, a `query`, `params` or `search`, resolves from them; in rules
through `bindRule`.

**Navigation.** `to`, `params`, `search` and `hash` are handed to TanStack Router's `navigate` once
their binds are resolved. `mode` says what the client does when the step becomes current:

- `navigate` goes there.
- `anchor` also goes there, but when that is the current page only the hash changes, and the page
  opens or scrolls to that section.
- `action` stays put; the work happens on the current page.

**Completion.** `completedWhen` names a read by its SDK operationId, fills it the way the SDK call
would (`{ path: { id } }`, plus `query`), and gives a plain json-rules `rule`. How the rule is read
depends on the route:

- **A paginated readMany with a `filterLens`:** the rule is matched per returned row, and the step
  completes when at least one row matches. One row must satisfy the whole rule; two rows each
  satisfying half of it do not complete the step.
- **A single read:** the rule is evaluated against the returned record. Counting is the rule's own
  job: `{ field: 'organizationUsers', arrayOperator: ArrayOperator.atLeast, count: 2, condition }`
  on a read whose response carries that relation (`meRead` does).

### Validation

Definitions are checked at boot (`app.ts`) and in `flowDefinitionIssues.test.ts`, so a bad
definition never reaches a user. For each step:

1. **`read` exists.** It names a registered `GET` route. The route index is filled by
   `autoRegisterRoutes`.
2. **Its route params are covered by binds.** `path` binds exactly the route's path params.
3. **The rule's fields are inside the read's lens** (`validateRuleInLens`). For a readMany that is
   the route's `filterLens`. For a single read it is the lens of its `responseSchema` (built by the
   SDK's `lensFromSchema`, with every relation in the response turned on). A rule over a relation
   the response doesn't carry fails here.
4. **Every bind is covered.** Each bind in the rule (`listBindings(rule, { required: true })`) and
   in `path` / `query` / `params` / `search` is in the bindings schema or is a system binding.

An `anchor` step must also have a `hash`.

## Evaluation

`POST /flow/:id/check` locks the flow (`db.findForUpdate`) and evaluates the current step. It
advances while each next step holds, possibly through several steps, and sets `completedAt` after
the last one.

A step is evaluated by calling its read route as the caller. `evaluateFlowStep` resolves the
operationId and path with `resolveOperation`, the helper the WebSocket layer uses. It then makes
the request through the batch sub-request machinery (`registerBatch` + `x-batch-id`), the same way
`/batch` runs sub-requests:

- **Identity.** The sub-request inherits the caller's user, token and spoof. Its permissions are
  rebuilt from them, and the route's middleware (`validatePermission`, …) runs.
- **Scoping.** The controller's own scoping and the route's `filterLens` run unchanged.
- **readMany** (`many` and `paginate: true` with a `filterLens`; any other list route fails
  validation). The rule, coerced by that lens, rides the batch context as a narrowing, and `filterLensSetter` stacks it on
  the route's lens as one more layer, the mechanism `scopeNarrowing` uses. A narrowing only
  narrows. The step holds when the route's `pagination.total` is greater than 0 (`pageSize=1`).
- **Single read.** The route returns its record, and `check(rule, data)` evaluates it in memory.
- **Refusal.** If the route refuses (403, 404), the step does not hold; any other status is also logged.
  If the route refuses at start, on the step creation stops on, `POST /me/flows` is a 403.

**Why this path.** Completion sees exactly what the SDK call returns to this user, so permissions
and tenancy cannot drift: there is no second implementation of them. For a readMany, the rule runs
in the database through the route's own `lensWhere`, so a read-many check never loads every row. A
single read is one record, so `check()` over the response is exact and cheap.

## Instance

`packages/db/prisma/schema/flow.prisma`

| Field | Meaning |
|---|---|
| `userId` | The person on the flow. Only they can read, check or cancel it. |
| `flowKey` | The registry entry. Immutable. |
| `bindings` | Bound at start, validated by `bindingsSchema`. Immutable. |
| `returnUrl` | The page that started the flow. Cancel and finish go here. App paths only. Immutable. |
| `currentStep` | Index of the step the user is on. Equals the step count once complete. |
| `completedSteps` | `[{ stepKey, completedAt }]`, appended when a step completes. |
| `completedAt` / `canceledAt` | Terminal states. |

**Per-step completion is stored as `completedSteps` on the instance, not as an event table.** It is
written once per step, in order, under the flow's row lock, together with `currentStep`. One row
keeps that atomic and makes reads a single row. The actions that completed a step are already
audit-logged by their own models.

**Not audit-enabled and not soft-deleted.** A flow is ephemeral navigation state, like `Session`
and `Token`. It is in `HARD_DELETE_ON_TOMBSTONE`, so it is deleted with its user.

## API

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/me/flows` | the user | `{ flowKey, bindings, returnUrl }`. Bindings failing the schema are a 400. Steps that already hold complete at once. |
| GET | `/flow/:id` | `read` | Never advances. |
| POST | `/flow/:id/check` | `operate` | Evaluates and advances. |
| POST | `/flow/:id/cancel` | `operate` | Returns the flow, carrying `returnUrl`. A completed flow is a 409. |

`flowSteps` in each response is `[{ key, label, mode, to, params, search, hash, completedAt }]`,
with binds resolved.

## Client

The flow id rides in the URL as `?flow=`. `FlowProvider` and `FlowBanner` are mounted by `AppShell`
and `FullscreenLayout`.

- `useFlow()` returns `{ flow, currentFlowStep, isActive, check(), cancel() }`, or `null`.
- `useStartFlow()` provides `startFlow({ flowKey, bindings, returnUrl? })`. It creates the flow and
  enters its current step. `returnUrl` defaults to the current page.
- **After any successful mutation**, while a flow is active, the provider calls `check()`. It
  subscribes to React Query's mutation cache, so every `useMutation` and `useOptimisticMutation`
  takes part. The flow's own requests are tagged `meta.flowMutation` and never trigger a check.
  Concurrent triggers share one request and re-run once.
- **When a check advances**, the client enters the new step by its `mode`, calling
  `navigate({ to, params, search, hash })`. Search is the step's own `search` plus `spoof` and
  `flow`; the step names its own context (`org`), so none leaks over from the current page. A check
  that settles after the user has left the flow navigates nowhere. Finishing or canceling goes to
  `returnUrl` exactly as captured: no current context, no current hash.
- **Navigation never advances.** Back, forward, links and reloads check nothing.
- **Anchors.** Pages open sections from the hash with `useHashSection(id)`. `OrganizationUsersPage`
  opens its invite modal on `#invite`, and `TokensPage` opens its create modal on `#create-token`,
  unless a new key is still being shown.
- **`Link`** keeps `?flow=` while a flow is active.

Buttons are plain buttons. They don't decide completion.

## Example: `setUpOrganization`

`apps/api/src/modules/flow/definitions/setUpOrganization/`, with bindings `{ organizationId }`:

| Step | Mode | Read | Rule (per row) |
|---|---|---|---|
| Invite a teammate | navigate `/users/members` `#invite` | `organizationSentManyInquiries` | `type = inviteOrganizationUser` and `status = sent` |
| Create an API token for CI | navigate `/settings/tokens` `#create-token` | `organizationReadManyTokens` | created since the flow started, and `name` contains `ci` |
| Create one for local development | anchor `#create-token` (same page) | same | created since the flow started, and `name` contains `local` |

`organizationSentManyInquiries`' `filterLens` does not expose `createdAt`, so the invite step
counts invitations sent before the flow too. That is the lens doing its job: a rule can't read what
the route doesn't expose.

## What flows are not

- **Not login.** Auth keeps its own `redirectTo`.
- **Not a write path.** Checking only reads; the step's own page does the work.
- **Not a wizard engine.** There is no branching and no form state.

## Source map

- Schema: `packages/db/prisma/schema/flow.prisma`; factory `flowFactory.ts`
- Registry: `apps/api/src/modules/flow/definitions/`
- Validation: `validations/flowDefinitionIssues.ts`; route index
  `apps/api/src/lib/routeTemplates/routeIndex.ts`
- Evaluation: `services/evaluateFlowStep.ts`, `services/readAsCaller.ts`,
  `services/responseLens.ts`, `services/advanceSatisfiedSteps.ts`. The batch narrowing lives in
  `modules/batch/services/batchRegistry.ts`, `middleware/prepareRequest.ts` and
  `lib/routeTemplates/utils/prepareMiddleware.ts`.
- Client: `packages/ui/src/components/flows/`, `packages/ui/src/hooks/flow/`,
  `packages/ui/src/hooks/useHashSection.ts`, `packages/ui/src/lib/flows/`
- Tests: `apps/api/src/modules/flow/tests/`, `packages/ui/src/components/flows/flowClient.test.tsx`
