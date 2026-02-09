# scripts/scratch

This folder is for experiments, one-off helpers, and draft automation ideas.

## Rules

- Do not call these from root `package.json` scripts.
- Do not rely on these in CI/CD.
- Do not treat these as stable interfaces.
- Promote a script to `scripts/{setup|deployment|db|watch}` only after it is reviewed and battle-tested.

## Naming

- Prefix drafts with date and intent, e.g. `2026-02-07-deploy-spike.sh`.
- Keep scripts self-contained and add usage notes at top of file.

## Promotion Checklist

- [ ] Reproducible
- [ ] Error handling present
- [ ] Idempotent where needed
- [ ] Documented
- [ ] Covered by tests or smoke validation

