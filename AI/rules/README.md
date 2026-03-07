# AI Rules

Golden conventions for this codebase. All agents read these. CI enforces them.

Rules live as `.md` files in this directory, one file per domain.

## Adding a rule

1. Document the convention in a `.md` file here
2. Add a CI rule in `scripts/ci/rules/<rule-name>.sh` if mechanically checkable
3. Add pass/fail fixtures in `scripts/ci/rule-violations/<rule-name>/`

Linter error messages should double as remediation instructions — when an agent
violates a rule, the error tells it exactly how to fix the violation.

See `AI/ENTRYPOINT.md` §9 for the CI rule runner.
