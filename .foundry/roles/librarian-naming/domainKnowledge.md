# Naming: template

- Use `utils`, not `helpers`; camelCase enums; `OrganizationUser`; `resourceAction` route names; resource-centric URLs (`rules/:id`). No kebab-case URLs. [×6 · 2025-12-21→2026-01-24]
- Route paths are always singular. (Plural was floated once and lost.) [reversal noted 2026-02]
- Models are PascalCase singular, everything else camelCase. Routes are named admin-model-action-subresource. One camelCase convention for files, scripts and routes, enforced by a CI rule. [×9 · ↻3 · 2026-01-25→03-19 · NAMING.md · REC]
- Environment label: `prod`, not `production`. [settled 2026-03]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/NAMING.md
