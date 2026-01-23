# Template Development Guide

## Template-Based Development Workflow

This is the template repository that serves as the base for inixiative and other apps.

### Development Principles

1. **Make changes in the appropriate repository**:
   - Generic improvements that benefit all apps → Make in `template` repository
   - App-specific features → Make directly in the app repository (e.g., `inixiative`)

2. **Dependency Management**:
   - NEVER install dependencies at the root level
   - Install dependencies in the specific app where they're needed:
     - API dependencies → `apps/api/package.json`
     - Web dependencies → `apps/web/package.json`
     - Admin dependencies → `apps/admin/package.json`
   - Root `package.json` should only contain workspace configuration and minimal devDependencies

3. **Syncing Changes**:
   - After making changes to the template, push them to the template repository
   - In the app repository (e.g., inixiative), run `bun run sync` or `./scripts/sync-template.sh`
   - This merges template changes directly into the app's main branch
   - Resolve any conflicts if they occur

### Quick Commands

```bash
# In template repository - make generic improvements
cd /path/to/template
# make changes
git add .
git commit -m "feat: improvement description"
git push origin main

# In app repository - sync template changes
cd /path/to/inixiative
bun run sync  # or ./scripts/sync-template.sh
# resolve conflicts if any
git push origin main
```

### Example: Adding a Package

```bash
# ❌ WRONG - Don't do this
cd /path/to/template
bun add dayjs  # This adds to root package.json

# ✅ CORRECT - Add to specific app
cd /path/to/template/apps/api
bun add dayjs  # This adds to api/package.json
```

### Important Notes

- Template changes should be generic and reusable across all apps
- App-specific business logic should never be added to the template
- Always test template changes don't break existing apps before pushing
- The sync process is designed to work directly on the main branch