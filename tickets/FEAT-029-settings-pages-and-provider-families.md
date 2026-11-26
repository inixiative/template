# FEAT-029: Settings across pages (billing and others) and provider families in setting trees

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-11-25
**Updated**: 2026-11-25
**Related**: [FEAT-026](./FEAT-026-settings-primitive.md), [FIN-001](./FIN-001-financial-fiat.md), `docs/claude/SETTINGS.md` (setting trees, R-2026-11-25-04), template #338

---

## Why

Settings are one tree per resource model (template #338). Two needs come next:

1. Settings that belong on another page, such as billing. Aron, 2026-11-25: "I think we can use this tree for things like billing and stuff. Might have billing settings, right? We would make a separate tree for that."
2. Settings shared by every product of one provider family, such as Atlassian for Jira and Confluence. Aron, 2026-11-25: "we should have something that represents provider groups … Atlassian would be the one for Jira and Confluence, right? Shared stuff would be there."

## Settings on more than one page: no second tree layer

Aron's refinement, 2026-11-25:

1. **When a real model owns the domain, the tree goes on that model.** Billing settings live on `SETTING_TREES.BillingAccount` (FIN-001's model), not on `Organization`. `/billing` renders `BillingAccount`'s tree and `/settings/settings` renders `Organization`'s. They don't overlap and need nothing new.
2. **When several pages configure settings stored on the same model, keep one tree per model and use top-level branches as the pages.** For example, `Organization.settings` is rendered by `/settings/settings` and `Organization.billing` by `/billing` through `<SettingTreeView path="billing" />`.
   - Keys are namespaced by the branch (`settings.*`, `billing.*`).
   - There's no cross-tree collision check, one `validateAttributeWrite`, one ReBAC compile and one `/setting/info` payload.
   - Everything already shares `Setting`'s `(resourceModel, resourceId, key)` unique index.
   - Don't build a registry of several trees beside `SETTING_TREES`.

To do:
- Add `BillingAccount` to `SettingResourceModel`, the Setting polymorphic arms and `SETTING_TREES` when FIN-001 lands.
- Render `/billing` with `SettingTreeView` on `BillingAccount`. It already takes an optional `path` that limits it to one branch.

## Provider families in setting trees

Integration and ProjectIntegration trees switch on two kind fields:
- `provider:<key>`, the integration's own provider;
- `integrationFamily:<key>` (labelled "Family"), the family the catalog declares for the provider, null when it declares none, so a family never matches an integration directly.

A provider in a family is declared inside its family's branch: `'integrationFamily:atlassian': { atlassian: {…shared}, 'provider:jira': { jira: {…} } }`.

**Decided (Aron, 2026-11-26):** Atlassian becomes a family for Jira and Confluence, and inixiative one for Chorus and Oracle; families become a first-class model. See FEAT-034.
