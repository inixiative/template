# Migration: Doppler → Infisical

**Date:** 2026-02-09
**Status:** Complete
**Reason:** Open-source alternative with 70-95% cost savings

---

## Summary

Replaced Doppler (commercial secrets manager) with Infisical (open-source) throughout the template.

**Cost comparison:**
- Doppler: $60-375/month (depends on team size)
- Infisical Cloud: $0-18/month (flat rate)
- Infisical Self-Hosted: ~$5-12/month (VPS costs)

---

## Files Changed

### Documentation

| File | Changes |
|------|---------|
| `docs/claude/INIT_SCRIPT.md` | Updated all Doppler references to Infisical, added cloud/self-hosted setup flows |
| `docs/claude/ENVIRONMENTS.md` | Replaced Doppler section with Infisical, updated environment table |
| `docs/claude/SCRIPTS.md` | Updated script references, removed doppler-env.sh |
| `docs/claude/SETUP.md` | Changed CLI requirements, removed Doppler login |
| `CLAUDE.md` | No changes needed (doesn't reference Doppler) |

### Scripts

| File | Changes |
|------|---------|
| `scripts/deployment/with-env.sh` | Rewrote to detect Infisical, fallback to .env files |
| `scripts/deployment/doppler-env.sh` | **Archived** as `doppler-env.sh.archived` |
| `scripts/setup/dopplerSetup.ts` | **Archived** as `dopplerSetup.ts.archived` |

### Configuration

| File | Changes |
|------|---------|
| `package.json` | Removed `setup:doppler` script |
| `doppler.config.ts` | **Archived** as `doppler.config.ts.archived` |

### Middleware (Previously Fixed)

| File | Changes |
|------|---------|
| `apps/api/src/middleware/auth/spoofMiddleware.ts` | Fixed race condition (null check added) |

---

## New Behavior

### Environment Variables

**Before (Doppler):**
```bash
# Cloud envs used Doppler configs
doppler run --config dev_api -- bun run start
```

**After (Infisical):**
```bash
# Cloud envs use Infisical
infisical run --env=dev -- bun run start

# Or via with-env wrapper (auto-detects)
bun run with dev api bun run start
```

### Setup Flow

**Before:**
1. `brew install dopplerhq/cli/doppler`
2. `doppler login`
3. `bun run setup:doppler`

**After:**
1. `bun run init` (includes Infisical setup)
2. Choose: Cloud (free) / Self-hosted / Manual .env
3. CLI auto-installs if missing

### Configuration Files

**Before:**
- `doppler.yaml` (created by `doppler setup`)
- `doppler.config.ts` (template config)

**After:**
- `.infisical.json` (created by `infisical init`)
  ```json
  {
    "workspaceId": "project-id",
    "domain": "https://app.infisical.com"  // or localhost:8080
  }
  ```

---

## Migration Guide for Existing Projects

If you have an existing project using Doppler:

### 1. Export Secrets from Doppler

```bash
# For each environment
doppler secrets download --config dev_api --no-file --format env > secrets-dev.env
doppler secrets download --config staging_api --no-file --format env > secrets-staging.env
doppler secrets download --config prod_api --no-file --format env > secrets-prod.env
```

### 2. Install Infisical CLI

```bash
brew install infisical/get-cli/infisical
```

### 3. Setup Infisical

**Option A: Cloud (recommended)**
```bash
infisical login  # Opens browser for OAuth
infisical init --name=your-project-name
```

**Option B: Self-hosted**
```bash
# Add Infisical to docker-compose.yml (see INIT_SCRIPT.md)
docker-compose up -d infisical
infisical login --domain=http://localhost:8080
infisical init --name=your-project-name --domain=http://localhost:8080
```

### 4. Import Secrets to Infisical

```bash
# Import each environment
infisical secrets set --from-file=secrets-dev.env --env=dev
infisical secrets set --from-file=secrets-staging.env --env=staging
infisical secrets set --from-file=secrets-prod.env --env=prod

# Clean up export files
rm secrets-*.env
```

### 5. Update CI/CD

**GitHub Actions:**
```yaml
# Before
- name: Load secrets
  run: |
    curl -Ls https://cli.doppler.com/install.sh | sh
    doppler run --config prod_api -- bun run start

# After
- name: Load secrets
  env:
    INFISICAL_TOKEN: ${{ secrets.INFISICAL_TOKEN }}
  run: |
    npm install -g @infisical/cli
    infisical run --env=prod -- bun run start
```

Generate service token:
```bash
# In Infisical web UI: Project Settings → Service Tokens
# Or CLI:
infisical service-token create --env=prod --name=github-actions
```

### 6. Update Local Development

Replace Doppler commands:
```bash
# Before
doppler run -- bun run local

# After
bun run with local api bun run local  # Uses .env.local files
```

### 7. Cleanup

```bash
# Remove Doppler files
rm doppler.yaml
rm doppler.config.ts

# Archive for reference if needed
mv doppler.yaml doppler.yaml.archived
```

---

## Verification

After migration, verify:

1. **Local development works:**
   ```bash
   bun run local
   # Should start without Doppler errors
   ```

2. **Secrets load correctly:**
   ```bash
   infisical run --env=dev -- env | grep DATABASE_URL
   # Should print your database URL
   ```

3. **CI/CD works:**
   - Push to staging/prod
   - Check deployment logs for secret injection

---

## Rollback (If Needed)

If you need to rollback:

1. Restore archived files:
   ```bash
   mv doppler.config.ts.archived doppler.config.ts
   mv scripts/setup/dopplerSetup.ts.archived scripts/setup/dopplerSetup.ts
   mv scripts/deployment/doppler-env.sh.archived scripts/deployment/doppler-env.sh
   ```

2. Update `package.json`:
   ```json
   "setup:doppler": "bun ./scripts/setup/dopplerSetup.ts"
   ```

3. Update `with-env.sh` to use `doppler-env.sh`

4. Run `bun run setup:doppler`

---

## Questions?

See:
- [INIT_SCRIPT.md](claude/INIT_SCRIPT.md) - Full Infisical setup documentation
- [ENVIRONMENTS.md](claude/ENVIRONMENTS.md) - Environment configuration
- [Infisical Docs](https://infisical.com/docs) - Official documentation
