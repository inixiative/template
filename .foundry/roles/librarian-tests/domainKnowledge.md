# Tests: template

- External integration tests use a VCR recorded against the real provider. Never hand-author fixtures, never mock or stub providers; one fixture per method. Init tests record everything. (Superseded: "remove init tests", 03-02.) [×15 · ↻3 · 2026-03-23→03-30 · INIT_SCRIPT_PATTERNS.md · not in memory although Aron asked]
- Route tests don't re-test auth/guard paths; the guard middleware has its own tests. [×2 · TESTING.md]
- Known flake: `integrationFactory` faker names collide in sendWebhook. Fix the factory; don't retry the test. [COORDINATION 10-11]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/TESTING.md
