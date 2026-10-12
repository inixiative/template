# Ship: template

- **Template is PR-for-Aron.** Never merge unasked. Exception: json-rules 3.x cut-over changes merge once green (10-08). [org CLAUDE.md]
- When you do merge something he should have reviewed, open a post-hoc review PR whose base pre-applies the formatter commits, so the diff is substance only. [memory posthoc_review_pr · #152]
- Prod and staging both track `main`; work lands via PRs into main. [×2 · ENVIRONMENTS.md]
- Every merged template change is followed by Kingdom and Tribe ports (Sync Warden).

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/SCRIPTS.md
@../../../docs/claude/CICD.md
@../../../docs/claude/DOCKER.md
