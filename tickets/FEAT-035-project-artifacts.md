# FEAT-035: Project-Scoped Artifacts (Tighter `Project` ↔ `Artifact` Coupling)

**Status:** 🆕 Not Started (Initial Investigation) · **Line:** FEAT · **Priority:** Medium · **Related:** `FEAT-009` (`template#72` Artifacts), `template#341` (`Project` `ReadAccess` × `OperateAccess`), `FEAT-033` (`transferProject` Inquiry), Kingdom `SystemFile`

## Context

`FEAT-009` (`template#72`) shipped `Artifact`, `ArtifactPlacement`, `ArtifactPermission`, and `ResourceBinding` with 5-way ownership (`ArtifactOwnerModel`: `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`) — the same 5 owners as `Project`.

Meanwhile, `Project` now carries `readAccess` (`public | tenant | private`) × `operateAccess` (`tenant | private`) (`template#341`), and Kingdom introduced a stopgap `SystemFile` model tied directly to `projectId` (with cascade delete on `Project` tombstone and `db:SystemFile` ReBAC delegating to `project:read` / `project:operate`) so Chorus and Oracle can store project-scoped bundles.

Open question raised during `template#341` review (Aron, 2026-11-26): **do `Artifact`s ever need to belong to a `Project` in a tighter coupling than `ResourceBinding`?**

## Initial Investigation — Options & Tradeoffs

| Option | Model | Where it works cleanly | Where it breaks (the real holes) |
|---|---|---|---|
| **1. Loose coupling (status quo in `#72`)** | `Artifact` stays 5-owner (`User`, `Org`, `Space`, `OrgUser`, `SpaceUser`). Projects reference artifacts via `ResourceBinding` or a folder placement. | Reusable/shared org assets (brand kits, templates, shared prompts) live once and link to many projects; zero extra owner-chain complexity on `Artifact`. | 1. **Permission drift:** granting someone access to Project X (via `readAccess`/`operateAccess`, a `db:Project` entitlement, or a Project-scoped Signet) does **not** grant access to Project X's files unless grants are mirrored into `ArtifactPermission`.<br>2. **Lifecycle mismatch:** deleting or transferring a Project (`FEAT-033`) leaves its files stranded on the org.<br>3. **Agents/Signets:** a Project-scoped Signet cannot read/write the project's files through `db:Project`. |
| **2. Tight coupling (`Project` as a 6th `ArtifactOwnerModel`)** | Add `Project` to `ArtifactOwnerModel` (`projectId` + carried owner keys). Each `Project` gets an eager `ArtifactKind.root` container (`ownerRootArtifact`), and `db:Artifact` delegates to `{ rel: 'project', action }` (mirroring how `Setting` already supports `Project`). | Project-scoped files automatically inherit `Project` `readAccess`/`operateAccess`, `db:Project` entitlements, and Project Signets; follow `transferProject` (`FEAT-033`); cascade cleanly on Project tombstone; and can eventually subsume Kingdom's stopgap `SystemFile`. | 1. **Two-level owner chain:** `Project` is itself 5-way owned, so `falsePolymorphism`, `tenantRowsAbove`, `withArtifactOwnersLock`, `ownerRootArtifact`, `accessibleArtifactWhere`, and `transferArtifact` all gain a 2nd hop.<br>2. **Nested access semantics:** requires an explicit rule for how `Project` (`readAccess`/`operateAccess`) interacts with `ArtifactPlacement` (`private`/`tenant`/`public`) inside a Project's root (e.g. does a `private` Project cap a `public` placement, or is placement `public` explicit opt-in?).<br>3. **Additive, not replacement:** shared company-wide files still live on the 5 org/user owners. |
| **3. `ProjectArtifact` junction + ReBAC `down` bridge** | `Artifact` stays 5-owner; a join table links `Artifact` ↔ `Project` and grants access across a ReBAC `down` list. | Avoids adding a 6th arm to `ArtifactOwnerModel`. | **Worst of both worlds:** still requires ReBAC `down` hydration + cache invalidation across the junction, AND still leaves delete/transfer ownership ambiguous (who owns the file if the Project deletes or transfers?). Not recommended. |

## Deciding Question Before Building

Option 3 should be ruled out. Between Option 1 (loose) and Option 2 (`Project` as a 6th `ArtifactOwnerModel`), the deciding product question is:

> **Should a `Project` have its own Drive/files workspace where `Project` access (`readAccess`/`operateAccess`), `db:Project` entitlements, and Project-scoped Signets/agents automatically reach the project's files (and where Kingdom's `SystemFile` can eventually graduate onto `Artifact`)?**

- If **yes** → implement **Option 2** (`Project` as 6th `ArtifactOwnerModel` with eager Project `root` container and explicit nested-access semantics), keeping Option 1 (`ResourceBinding` / cross-owner placements) for reusable org/user assets.
- If **no** (Artifacts stay strictly an org/user Drive that Projects only reference) → stay on **Option 1** and keep `SystemFile` separate for internal vendor blobs.
