# Flows

A flow walks a user through a few in-app pages, like a tax-filing wizard: invite a teammate, then create a CI token, then a local one. It is a convenience, not a contract. If anything goes wrong — a step's check fails, the user leaves the flow's pages, nobody touches it for 15 minutes — the flow is deleted and the user is simply back on the normal site.

## Contents

- [Definitions](#definitions)
- [Lifecycle](#lifecycle)
- [Routes](#routes)
- [Client](#client)
- [Adding a flow](#adding-a-flow)

## Definitions

Definitions live in code, in `apps/api/src/modules/flow/definitions`, keyed by the `FlowKey` enum (`Record<FlowKey, FlowDefinition>`, like the inquiry handlers).

```ts
type FlowDefinition = {
  key: FlowKey;
  bindingsSchema: z.ZodObject;                 // what the caller must send, e.g. { organizationId }
  steps(bindings, now: Date): FlowStepInput[]; // plain TS; interpolate bindings directly
};

type FlowStepInput = {
  key: string;
  label: string;
  to?: string;                   // in-app URL incl. search + #hash; omit for a step done in place
  advance: 'auto' | 'confirm';
  read: { operationId: string; path?: Record<string, string>; query?: Record<string, unknown> };
  rule: Condition;               // json-rules, checked over { data }
};
```

- **`read`** names a GET route by its SDK operationId. Put every predicate the route's own `searchFields` can express in `query`; the rule only judges what comes back.
- **`rule`** runs with json-rules `check` over `{ data }`. For a list read, `data` is every matching row (pages walked with `fetchAllPages`, capped); use `ArrayOperator.notEmpty` / `atLeast` / `any`. For a single read, `data` is the record.
- **`advance`**: `auto` moves the user to the next step as soon as the step holds. `confirm` waits for the user (see [Client](#client)). Use `confirm` when the page shows something the user must see before leaving, like a token's one-time secret.
- **`returnUrl`**: a definition may accept an optional `returnUrl` binding (`flowUrlSchema`, in-app paths only). Without it the flow ends on `/dashboard`.

## Lifecycle

```
POST me/flows {flowKey, bindings}
  → bindings parsed by bindingsSchema (400 + fieldErrors)
  → steps(bindings) resolved: operationId → path, query → bracket query string
  → stored on Flow.steps (immutable: editing a definition never touches a running flow)
  → checked (below), returned

GET flow/:id   (on mount, and after every successful mutation)
  → recheck from step 0, in order, as the caller; stop at the first step that does not hold
  → currentStep = that step; stepStates = done / pending per step (computed, not stored)
  → touches updatedAt
```

- **Backward moves are normal.** Delete the CI token and the next read puts you back on that step.
- **Reads run as the caller** through the batch sub-request machinery (`registerBatch` + `executeRequest`): same session, permissions, tenancy and rate-limit exemption as the caller's own request.
- **Any read error drops the flow**: non-2xx, a thrown rule, or a `fetchAllPages` cap. The row is deleted and the GET answers 404.
- **Finished**: when every step holds, the response carries `currentStep === steps.length` and the row is hard-deleted.
- **Don't pre-check; create and see.** Create runs the same checks. A flow whose steps all hold already comes back complete and is never stored, so a caller never has to ask "does this user need the flow?" first.
- **Cleanup**: `Flow` rows hold only `id, userId, flowKey, steps, returnUrl, createdAt, updatedAt`. The `cleanStaleFlows` cron row runs `cleanStaleData` every 5 minutes on `updatedAt` with a 15-minute retention. Flows are hard-deleted with their user.

## Routes

| Route | operationId | |
|---|---|---|
| `POST /api/v1/me/flows` | `meCreateFlow` | body `{ flowKey, bindings }` → 201 flow |
| `GET /api/v1/flow/:id` | `flowRead` | recheck; 404 once dropped or finished |
| `DELETE /api/v1/flow/:id` | `flowDelete` | 204 |

The response is the `Flow` row with `steps` parsed, plus the computed `stepStates` and `currentStep`.

## Client

All of it is in `packages/ui`; pages need no flow code.

- **State**: `navigation.flowId`, `navigation.flow` (last response) and `navigation.flowContinue` in the store. The store is the truth; the `flow` search param mirrors it like `spoof` (`useAuthenticatedRouting`), is seeded from `?flow=` on load, and is kept by `navigatePreserving`.
- **Reads**: `FlowBanner`, mounted once in each app's `__root.tsx`, runs the flow read (`lib/flows/flowReadQuery.ts`, `staleTime: 0`). The app `MutationCache` invalidates it after every successful mutation unless the mutation has `meta: { skipFlowInvalidate: true }`.
- **Advancing**: when a read moves `currentStep` forward past an `auto` step, the user is sent to the next step's `to` (or `returnUrl` at the end). Past a `confirm` step, `flowContinue` is set: the banner shows a `Continue: <next step>` (or `Finish`) button, and any open `Modal` turns its close button into the same button, so closing the token-reveal modal continues the flow.
- **Dropping off**: landing on a pathname that is not one of the steps' `to`, the `returnUrl`, `/dashboard`, `/login` or `/auth/callback` clears the flow and fires `DELETE`. Search and hash are ignored. A 404 on the read clears it with a quiet "Setup guide ended" toast. Changing spoof clears it. The banner's Dismiss does the same as leaving.
- **Starting**: `useStartFlow().mutate({ flowKey, bindings })` sends the current path as `returnUrl` and navigates to the first pending step.
- **Deep links into modals**: `useSectionOpen('create-token')` keeps a modal's open state in the URL hash, so a step's `to` of `/settings/tokens#create-token` opens the dialog.

## Adding a flow

1. Add the key to `enum FlowKey` (`packages/db/prisma/schema/flow.prisma`).
2. Write the definition under `definitions/<key>/` and register it in `definitions/index.ts`.
3. Add a caller to `callerFor` in `modules/flow/tests/flowDefinitions.test.ts`. That test creates the flow with factory data and asserts every step's read is a real route that answers 200, which catches unknown operationIds and filters the route rejects.
