# Flows

A flow walks a user through a few in-app pages, like a tax-filing wizard: invite a teammate, then create a CI token, then a local one. It is a convenience, not a contract. If anything goes wrong — a step's check fails, the user leaves the flow's pages, nobody touches it for 15 minutes — the flow is deleted and the user is simply back on the normal site.

## Contents

- [Registry](#registry)
- [Lifecycle](#lifecycle)
- [Routes](#routes)
- [Client](#client)
- [Adding a flow](#adding-a-flow)

## Registry

Flows are registered in code: `apps/api/src/modules/flow/registry/flowRegistry.ts` exports `flowRegistry: Record<FlowKey, FlowDefinition>` (like the inquiry handlers), and each flow is one file in that folder (`registry/setUpOrganization.ts`, bindings schema included).

```ts
type FlowDefinition = {
  key: FlowKey;
  bindingsSchema: z.ZodType<Record<string, unknown>>;   // what the caller must send, e.g. { organizationId }; strict
  steps(bindings, { userId, now }): Promise<FlowStep[]>; // plain TS; userId is the flow's owner (the caller)
};

type FlowStep = {                // exactly what is stored on Flow.steps
  key: string;
  label: string;
  to: string | null;             // in-app URL incl. search + #hash; null for a step done in place
  advance: FlowStepAdvance;      // 'auto' | 'confirm', from @template/shared/flows
  readPath: string;              // await apiPath(operationId, pathParams, query)
  rule: Condition;               // json-rules, checked over { data }
};
```

- **`readPath`** comes from the generic `apiPath(operationId, pathParams?, query?)` (`apps/api/src/lib/openapi/apiPath.ts`): it resolves the SDK operationId to its path and serializes `query` with `serializeBracketQuery`. Put every predicate the route's own `searchFields` can express in `query`; the rule only judges what comes back.
- **`rule`** runs with json-rules `check` over `{ data }`. For a list read, `data` is every matching row (`readAllAsCaller` walks the pages with `fetchAllPages`, capped); use `ArrayOperator.notEmpty` / `atLeast` / `any`. For a single read, `data` is the record.
- **`advance`**: `auto` moves the user to the next step as soon as the step holds. `confirm` waits for the user (see [Client](#client)). Use `confirm` when the page shows something the user must see before leaving, like a token's one-time secret.
- **Bindings never carry the caller.** A flow belongs to its user (`Flow.userId`), and `createFlow` hands `steps` that `userId`. Bindings schemas are strict (`z.strictObject`), so a `userId` in the body is a 422; the registry test sends one for every flow.
- **Polymorphic targets** use `polymorphicSchema` ([HOOKS.md](HOOKS.md#request-validation)) with `omit: ['userId']`, so a personal target is just `{ ownerModel: 'User' }`, and `extend` for the flow's other bindings (`returnUrl`).
- **`returnUrl`**: a flow may accept an optional `returnUrl` binding (`appPathSchema` from `@template/shared/utils`, in-app paths only). Without it the flow ends on `/dashboard`.

## Lifecycle

```
POST me/flows {flowKey, bindings}
  → bindings parsed by bindingsSchema (422, fieldErrors under bindings.*)
  → steps(bindings, { userId: caller, now }) → stored on Flow.steps (immutable: editing the registry never touches a running flow)
  → checkFlow

GET flow/:id   (on mount, and after every successful mutation)
  → checkFlow

checkFlow
  → from step 0, in order, as the caller; stop at the first step that does not hold
  → currentStep = that step; stepStates = done / pending per step (computed, not stored)
  → update (touches updatedAt), or delete when every step holds
```

- **Backward moves are normal.** Delete the CI token and the next read puts you back on that step.
- **Reads run as the caller** through `readAllAsCaller` / `readAsCaller` in the batch module (`registerBatch` + `executeRequest`): same session, permissions, tenancy and rate-limit exemption as the caller's own request.
- **Any read error drops the flow**: non-2xx, a thrown rule, or a `fetchAllPages` cap. The row is deleted and the route answers 404. Two tabs racing to finish the same flow end the same way: the loser's write misses the row (P2025) and answers 404.
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

- **State**: the store holds only `navigation.flowId` (`setFlowId(id | null)`). The flow itself lives in the React Query cache (`lib/flows/flowReadQuery.ts`, `staleTime: 0`) and is read with `useActiveFlow()`. The `flow` search param mirrors `flowId` like `spoof` (`useAuthenticatedRouting`), is seeded from `?flow=` on load, and is kept by `navigatePreserving`.
- **Rechecks**: the app `MutationCache` invalidates the flow read after every successful mutation, unless the mutation has `meta: { skipFlowInvalidate: true }` or the cached flow is already finished.
- **What's next**: `flowNext(flow, pathname)` is the one rule. Finished → `Finish` to `returnUrl ?? '/dashboard'`. Otherwise, if the current step's `to` is on another page → `Continue: <step label>`. Otherwise nothing (you are already where the step happens).
  - `FlowBanner`, mounted once in each app's `__root.tsx`, shows it as a button.
  - Any open `Modal` turns its close button into it, so closing a dialog continues the flow.
  - After an `auto` step completes, the banner follows it by itself. A `confirm` step waits for the button.
- **Dropping off**: landing on a pathname that is not one of the steps' `to`, the `returnUrl`, `/dashboard`, `/login` or `/auth/callback` clears the flow and fires `DELETE`. Search and hash are ignored. A failed read clears it with a quiet "Setup guide ended" toast. Changing spoof clears it. The banner's Dismiss does the same as leaving.
- **Starting**: `await useStartFlow().mutateAsync({ flowKey, bindings })` returns `{ started, flow }`. Pass `returnUrl` in `bindings` only when you want one. If every step already holds, `started` is `false` and nothing navigates, so the caller just carries on ("create and see"). Otherwise the user goes to the first pending step.
- **Deep links into modals**: `useSectionOpen('create-token')` keeps a modal's open state in the URL hash, so a step's `to` of `/settings/tokens#create-token` opens the dialog.

## Adding a flow

1. Add the key to `enum FlowKey` (`packages/db/prisma/schema/flow.prisma`).
2. Write `registry/<key>.ts` (strict bindings; the caller comes from `steps`' `userId`) and add it to `flowRegistry`.
3. Add a caller to `callerFor` in `modules/flow/tests/flowRegistry.test.ts`. That test creates the flow with factory data and asserts every step's read is a real route that answers 200, which catches unknown operationIds and filters the route rejects.
