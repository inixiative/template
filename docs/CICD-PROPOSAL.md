# CI/CD and infrastructure policy for Template

Status: proposal for review. Only the Vercel branch allowlist correction is implemented in this PR. The configuration and commands below describe the proposed interface; they do not exist yet.

## Purpose

Every Template copy should have a repeatable way to configure infrastructure, validate a revision, deploy it, inspect its health, and tear down temporary environments. Railway hosts the API, worker, PostgreSQL and Redis; Vercel hosts enabled frontend apps; Infisical owns secrets. Init gathers the choices and adopts or provisions resources. The same operational commands remain usable after init.

## Agreed controls

| Concern | Policy |
| --- | --- |
| Production on main | Automatic after passing CI, or manual deploy |
| PR preview deployment | `auto` or `manual` |
| Draft PR deployment | Independent `auto` or `manual`; overrides ordinary PR behavior while draft |
| Staging | On or off, with an explicit branch when enabled |
| Human PR approval | On or off |
| Preview cleanup | Automatic when a PR merges or closes; manual teardown also available |
| Validation | Pre-deployment checks and post-deployment checks |
| Configuration | Committed `cicd.config.ts`, separate from init progress and resource IDs |

Manual means an operator explicitly deploys a selected revision. Later pushes do not refresh a manual preview automatically. Marking a draft ready switches to the ordinary PR policy. Auto mode reacts to eligible PR updates; it must not deploy every unrelated branch push.

The human approval control is proposed as a merge requirement, separate from preview deployment. This allows a reviewer to use a preview before approving the PR. Confirm this interpretation during review. If approval is instead intended to gate previews, represent that as a distinct control rather than silently giving one flag both meanings. With merge approval enabled, dismiss stale approvals on new changes and do not count bot reviews. Provider/GitHub plan support must be checked and reported accurately.

Forks do not receive privileged deployment credentials. Auto/manual deployment never bypasses required checks, caller authorization, or trusted-revision policy. PR-owned executable configuration must not control privileged workflow execution; deployment policy is loaded from the trusted default branch.

## Proposed configuration

```ts
export const cicdConfig = {
  production: {
    branch: 'main',
    deploy: 'auto',
  },
  staging: {
    enabled: false,
    branch: 'staging',
  },
  pullRequests: {
    deploy: 'manual',
    drafts: { deploy: 'manual' },
    requireHumanApproval: true,
    cleanupOnClose: true,
    maxActive: 2,
  },
  checks: {
    pre: ['lint', 'typecheck', 'test', 'test:fe', 'ci-rules', 'build', 'schema'],
    post: ['api-readiness', 'worker-readiness', 'web-smoke', 'auth-smoke'],
  },
  database: {
    strategy: 'schema-push',
  },
  dashboard: {
    enabled: false,
  },
};
```

These values are proposed defaults, not yet accepted choices. The schema should use discriminated unions where appropriate: disabled staging does not require a branch. Check names resolve through a maintained command registry. CI must enforce the repository's canonical checks; config cannot silently turn a required failure into success. Synthetic data and disabled external side effects are the preview defaults.

Init edits this file through its Delivery section. Resource IDs remain in the existing project configuration initially; secrets never enter either file. Generated workflow/provider settings must be deterministic and checked for drift. There must be exactly one owner of deployment triggers for each target.

## Commands and shared execution

Proposed commands:

```sh
bun run infra:plan
bun run infra:apply
bun run infra:status
bun run deploy -- --env=production --sha=<commit>
bun run deploy -- --env=staging --sha=<commit>
bun run deploy -- --pr=123 --sha=<commit>
bun run teardown -- --pr=123
```

The deploy command resolves the revision, verifies its checks and authorization, plans affected services, and runs the same release procedure used by CI. Local execution should normally dispatch that workflow and follow its result, keeping privileged deployment execution in one place. Teardown produces an inventory of owned preview resources and removes only those bindings; production is not an accepted default teardown target.

Infrastructure planning compares desired settings with observed remote state. Existing projects can be explicitly adopted by ID; a stale init completion flag never proves that a resource still exists or has the intended settings. Persist partial progress and distinguish a missing resource from an authorization or network failure. Concurrent apply/deploy/cleanup operations need an environment lock and revalidation before each mutation.

## Release and preview lifecycle

1. Resolve the exact commit and enabled apps; validate dependencies, configuration and provider access.
2. Run prechecks, with isolated PostgreSQL, Redis and storage for tests. No tests use production data or secrets.
3. Serialize production releases. Once migrations begin, a newer push cannot cancel the active release.
4. Apply the environment's database policy once, then deploy API and worker at the selected revision.
5. Verify readiness, deploy frontends with the correct API origin, and run application/auth smoke checks.
6. Record commit, config digest, provider deployment IDs, database step, checks, URLs and outcome.

Cross-provider deployment is not atomic. Require backward-compatible schema/API changes, preserve failed partial outcomes, and provide explicit recovery. Application rollback does not imply database rollback. Build provenance must identify the actual commit/artifact; a later branch head must not be substituted for the checked revision.

A full-stack PR preview owns its API, worker, database, Redis/queues, storage scope, frontend deployments, auth origins and scoped secrets. Provision from preview-specific configuration rather than cloning production credentials. Frontends must wait for the preview API URL before building. Workers must not process another environment's queues. External email, webhooks and paid calls remain disabled unless separately configured for the preview.

Cleanup runs on merge or close, including partially failed provisioning. It uses stored IDs and verified ownership, preserves persistent resources, reports failures, and can be rerun. A periodic reconciliation job catches missed close events and orphaned previews. A closed PR cannot be reprovisioned by a late in-flight deployment. Expiry and maximum active environments bound resource use; monetary alerts are not represented as hard spending caps unless the provider enforces them.

## Database policy before migrations exist

The repository currently has no migration SQL files. Switching immediately to `prisma migrate deploy` would not materialize the current schema, so the initial CI/CD release needs an explicit schema-push phase.

- For disposable local/test/PR databases, allow schema push and an explicitly scoped rebuild/reseed operation.
- For persistent staging/production databases during prototyping, use schema push without `--accept-data-loss`. If Prisma reports potentially destructive changes, stop and require a reviewed schema/data transition. This is a guard against detected data loss, not a guarantee that every schema change is operationally safe.
- Remove `launched` as the authority for destructive database changes. Disposability belongs to the managed environment binding and must be checked against the actual target; a PR cannot label a production database disposable through its config.
- Make required seed failures fail the release. Keep optional demo data out of persistent environments.

When a project adopts migrations, generate and commit an initial baseline representing its schema. Verify it by creating an empty disposable database and comparing the result. For existing databases, back up and compare their actual schema before marking that baseline applied. Do not execute table-creation SQL over an existing database or mark a mismatched schema as migrated. Subsequent releases use reviewed migrations; CI verifies both creation from empty and upgrade from the previous baseline.

Template copies can remain in schema-push mode while being developed. The migration transition is an explicit operation, not an automatic consequence of a launch flag.

## Dashboard: ongoing operations, separate from init

| Option | Benefit | Cost |
| --- | --- | --- |
| Init and CLI only | Smallest operational surface; usable during application outages | Status is split across commands and provider dashboards |
| Optional DevOps page in superadmin | Reuses Template authentication and gives every copy a consistent operational view | The application being unhealthy can make its own page unavailable |
| Separate ops application | Independent availability and a natural home for multiple projects | Another deployment, authentication boundary and service to maintain |

Recommendation: ship an optional superadmin DevOps page with each Template copy, selectable in init, using the same commands/workflow contracts. Keep CLI and GitHub operational independently so the page is never necessary for recovery. Avoid making a new always-on ops service a prerequisite for every project.

The first page should show environments, deployed revisions, checks, drift, active previews and resource links. Authorized actions can dispatch deploy, rerun checks and preview teardown through the same audited workflow. Do not put provider tokens in browser code or run arbitrary shell commands from the page. Changes to committed policy should be proposed through a PR, not saved as a competing dashboard-only configuration.

## Implementation sequence and acceptance

1. Fix current Vercel branch matching in all three apps. Explicitly deny all branches and allow main until managed workflow triggers replace native autodeployment.
2. Add the typed policy, init controls and read-only plan/status. Test every PR/draft auto/manual combination and human-approval/staging toggles; report unsupported provider capabilities.
3. Implement canonical CI, database-mode checks and manual production/staging deployment. Prove a failed precheck cannot deploy, exact revision provenance is retained, and concurrent production releases cannot overlap migrations.
4. Implement PR deployment and teardown with isolation, partial-failure recovery and close-event reconciliation. Prove repeated cleanup is safe and late deployments cannot resurrect closed previews.
5. Add automatic triggers using the same release path, then the optional DevOps page. Exercise failed postchecks, stale configuration, provider outages and rollback/recovery in disposable environments.

Use Zealot's separation of validation, review deployments and visible cleanup failures as inspiration. Do not inherit temporary failure-tolerant CI gates, production deployment cancellation, or provider-specific assumptions from its Render/PlanetScale setup.

## References

- [Vercel branch matching](https://vercel.com/docs/project-configuration/git-configuration): unspecified branches default to enabled; a true matching rule wins over false matching rules.
- [Railway GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys)
- [Railway environments](https://docs.railway.com/environments)
- [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [Prisma schema prototyping](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/prototyping-your-schema)
- [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
