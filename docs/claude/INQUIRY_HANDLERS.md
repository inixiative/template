# Inquiry Handlers

Each inquiry type has a handler that defines its source/target structure, content/resolution schemas, optional validation, and approval side effects.

## Handler Structure

```typescript
export type InquiryHandler = {
  sources: SourceConfig[];          // Who can send (model + FK field mapping)
  targets: TargetConfig[];          // Who receives (model + FK field mapping)
  contentSchema: ZodSchema;         // Validated on create
  resolutionSchema: ZodSchema;      // Validated on resolve
  validate?: (db, inquiry) => Promise<void>;  // Pre-create validation
  handleApprove: (db, inquiry, resolvedContent) => Promise<Record<string, unknown>>;
  unique: boolean;                  // Whether only one open inquiry allowed per source+target
};
```

## resolvedContent and the Override Pattern

When a handler's `handleApprove` runs, it receives `resolvedContent` — the **merged** result of the original `content` and any override fields from the resolution payload:

```typescript
const merged = resolveContent(content, resolutionData, handler.resolutionSchema);
```

**Overrides are schema-gated**: only keys explicitly declared in the handler's `resolutionSchema` (and not in `RESOLUTION_METADATA_KEYS`) are allowed to override content. Any other keys in the request body are ignored during the merge.

```
resolutionSchema.shape keys
  → filter out metadata keys (explanation, resolvedBy, etc.)
  → remaining keys are the ONLY ones that can override content
```

This means an approver can only modify outcome fields that the handler author explicitly opted into. There is no implicit escalation.

### Opting into the override pattern

To allow the approving party to override a content field, add it to the handler's `resolutionSchema`:

```typescript
// In handlers/createSpace/resolutionSchema.ts
export const createSpaceResolutionSchema = z.object({
  explanation: z.string().optional(),
  name: z.string().optional(),  // ← declared here → resolver can override the requested name
});
```

Then use `resolvedContent` (not `inquiry.content`) in `handleApprove`:
```typescript
const name = resolvedContent.name as string;  // may be overridden by admin
```

Use this when the **approving party** has authority to modify the outcome — e.g.:
- Admin overrides a requested space name when approving `createSpace`
- Admin sets a different target organization when approving `transferSpace`

### When NOT to opt in (current `inviteOrganizationUser` behavior)

`inviteOrganizationUser` deliberately reads from `inquiry.content` directly — the **inviting org admin** sets the role when sending the invitation. The invitee (resolver) has no authority to change the role they're being offered.

`role` is intentionally absent from `inviteOrganizationUserResolutionSchema`, so it can never reach `resolvedContent`. The handler also reads from `inquiry.content` directly as a second layer:

```typescript
// ✅ Correct — role comes from original invite content, set by the admin
const role = (inquiry.content as any).role ?? 'member';

// ❌ Wrong — would allow the invitee to choose their own role
const role = resolvedContent.role ?? 'member';
```

## Handlers

| Type | Source | Target | Unique | Side effect on approve |
|------|--------|--------|--------|------------------------|
| `inviteOrganizationUser` | Organization (admin+) | User | Yes | Creates `OrganizationUser` |
| `createSpace` | Organization (member+) | admin | No | TODO: creates `Space` |
| `updateSpace` | Space (admin+) | admin | Yes | TODO: updates `Space` |
| `transferSpace` | Space (admin+) | Organization | Yes | TODO: transfers `Space` |

## Adding a New Handler

1. Create `handlers/<type>/index.ts` implementing `InquiryHandler`
2. Add content + resolution schemas
3. Implement `handleApprove` — return `{}` or an output object merged into `resolution`
4. Register in `handlers/index.ts`
5. Add the type to `InquiryType` enum in `inquiry.prisma`
6. Add `send` permission rule in `packages/permissions/src/rebac/schema.ts`
