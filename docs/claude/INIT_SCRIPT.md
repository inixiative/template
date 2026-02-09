# Init Script Implementation (`bun run init`)

## Context

Currently, setting up a fresh fork of this template requires ~2 hours of manual work:
- Renaming @template/* to @projectname/* in package names and imports
- Generating secrets (BETTER_AUTH_SECRET, webhook signing keys)
- Creating .env files from examples
- Setting up Doppler (REQUIRED for this template)
- Provisioning cloud services (Render, Sentry, email, OAuth)
- Configuring DNS and domain settings
- Starting Docker, initializing database, running seeds
- Testing that everything works

This plan implements an automated `bun run init` script that reduces this to ~10-15 minutes of interactive setup.

**Why this change is needed:**
- New developers can fork and be production-ready in minutes vs hours
- Eliminates manual errors in renaming and secret generation
- Provides consistent, tested setup process for local AND cloud environments
- Enables resumable setup if network/Docker fails mid-process
- Supports re-running to change project name (template → name1 → name2)

**Key Architectural Decision:**
- **Surgical rename approach**: Only replace @template in package.json names and TypeScript imports
- **Everything else uses PROJECT_NAME env var**: Container names, database names, service names all read from env var
- **Benefits**: Re-runnable (can change name multiple times), cleaner separation of concerns, easier to maintain

## Current State

**Existing Setup** (`bun run setup`):
- ✅ Works for developers joining an already-initialized project
- Linear flow: prereqs → env files → docker → db:generate → db:push → db:seed
- Located: `/scripts/setup/setup.sh`
- **Multi-dev workflow:** After someone runs `init`, other devs run `setup` (not init)
  - **init-config.json is committed to git** (everyone has the same config)
  - Setup pulls secrets from Doppler (not from config file)
  - Config has shared project settings (name, domain, flags, service IDs)
  - Secrets live in Doppler (per environment: dev/staging/prod)

**Existing Init Stub** (`/scripts/setup/init.sh`):
- ❌ TODO comments only, not implemented
- Has placeholder sections for: rename, secrets, env files, database

**Existing Components to Reuse:**
- `/scripts/setup/check-prereqs.sh` - Verifies Bun + Docker (will enhance)
- `/scripts/setup/sync-env.sh` - Copies `.env.example` → `.env` files
- `/scripts/setup/dopplerSetup.ts` - Creates Doppler project + configs
- `/scripts/setup/wait-postgres.sh`, `wait-redis.sh` - Health checks
- `/scripts/deployment/with-env.sh` - Environment composition

**Comprehensive Ticket** (`/tickets/INFRA-001-init-script.md`):
- Specifies 9 phases including cloud service provisioning (Render, Sentry, email, OAuth)
- Includes progress tracking, DNS setup, production deployment
- Very comprehensive scope

## Proposed Design

### Commands

**Three commands for different use cases:**

1. **`bun run init`** - Smart default
   - Detects existing `init-config.json`
   - If found: Resumes from last step
   - If not found: Starts new initialization (same as `init:new`)
   - Uses `db:push` by default (faster for dev)

2. **`bun run init --migrate`** - Production-ready init
   - Same as `init` but uses `db:migrate` instead of `db:push`
   - Recommended for production environments
   - Creates migration files for version control

3. **`bun run init:new`** - Force new initialization
   - If `init-config.json` exists: Prompt for confirmation
   - Creates fresh config and starts from beginning
   - Use when re-initializing with new project name
   - Supports `--migrate` flag

4. **`bun run init:edit`** - Edit configuration via TUI
   - Load `init-config.json`
   - Present TUI with current values pre-filled
   - Update config and optionally re-run affected steps

**Examples:**
```bash
bun run init              # Dev setup with db:push
bun run init --migrate    # Production setup with db:migrate
bun run init:new          # Fresh start with db:push
bun run init:new --migrate # Fresh start with db:migrate
```

### Launch Script

**Go from draft → live** (provision cloud services and deploy)

**`bun run launch`** - Provision services and go live

**Concept:** Launch uses the collected API keys to provision cloud services (Render, Sentry) and deploy the application.

**Flow:**
```
┌─────────┐    ┌─────────┐    ┌──────────┐
│  Init   │ → │  Develop │ → │  Launch  │
│ (setup) │    │ (build)  │    │ (go live)│
└─────────┘    └─────────┘    └──────────┘
launched:      launched:       launched:
false          false           true
(draft)        (draft)         (live)
```

**Note:** Dev vs Prod environments are handled by git branches, not config mode.

```typescript
// scripts/launch/index.ts
import { loadConfig, saveConfig } from '../init/utils/config';
import { $ } from 'bun';
import chalk from 'chalk';
import ora from 'ora';
import { confirm, select } from '@inquirer/prompts';
import boxen from 'boxen';

async function main() {
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red('❌ Project not initialized. Run `bun run init` first.'));
    process.exit(1);
  }

  // Check if already launched
  if (config.launched) {
    console.log(chalk.yellow('⚠️  Project already launched!'));
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Re-deploy (update live services)', value: 'redeploy' },
        { name: 'Exit', value: 'exit' }
      ]
    });
    if (action === 'exit') process.exit(0);
  }

  // Show what will change
  console.log(boxen(
    chalk.bold('🚀 Production Mode Configuration\n\n') +
    chalk.dim('The following flags will be updated:\n\n') +
    formatFlagChanges(config),
    { padding: 1, borderColor: 'cyan' }
  ));

  const confirmed = await confirm({
    message: 'Switch to production mode?',
    default: false
  });

  if (!confirmed) {
    console.log(chalk.yellow('Cancelled.'));
    process.exit(0);
  }

  console.log(chalk.cyan(`\n🚀 Launching ${config.project.name} to production...\n`));

  // 1. Update configuration flags
  let spinner = ora('Updating configuration flags...').start();
  updateProductionFlags(config);
  await saveConfig(config);
  spinner.succeed('Configuration updated to production mode');

  // 2. Generate CI/CD workflow files
  spinner = ora('Generating CI/CD workflows...').start();
  await generateCICDWorkflows(config);
  spinner.succeed('CI/CD workflows generated');

  // 3. Create database migrations (if not using migrate already)
  if (config.flags.database.strategy === 'migrate') {
    spinner = ora('Creating database migrations...').start();
    await $`cd packages/db && bun run db:migrate:create`.nothrow();
    spinner.succeed('Migrations created');
  }

  // 4. Update git branch protections
  spinner = ora('Updating git branch protections...').start();
  await updateGitBranchProtections(config);
  spinner.succeed('Branch protections configured');

  // 5. Deploy to production
  const shouldDeploy = await confirm({
    message: 'Deploy to Render now?',
    default: true
  });

  if (shouldDeploy) {
    spinner = ora('Deploying to Render...').start();
    await deployToProduction(config);
    spinner.succeed('Deployed to production');

    spinner = ora('Running production migrations...').start();
    await runProductionMigrations(config);
    spinner.succeed('Production database migrated');

    spinner = ora('Verifying production health...').start();
    await verifyProductionHealth(config);
    spinner.succeed('Production verified');
  }

  // 6. Mark as launched
  config.launchedAt = new Date().toISOString();
  await saveConfig(config);

  // Success!
  console.log('\n' + boxen(
    chalk.bold.green('🎉 Production Mode Active!\n\n') +
    chalk.dim('Configuration:\n') +
    chalk.white(`  • Mode: ${chalk.cyan('production')}\n`) +
    chalk.white(`  • Database: ${chalk.cyan('migrate')}\n`) +
    chalk.white(`  • CI/CD: ${chalk.cyan('enabled')}\n`) +
    chalk.white(`  • Auto-deploy: ${chalk.cyan('enabled')}\n\n`) +
    chalk.dim('Your app is live at:\n') +
    chalk.cyan(`  https://${config.project.domain}\n`) +
    chalk.cyan(`  https://api.${config.project.domain}\n\n`) +
    chalk.dim('Next steps:\n') +
    chalk.white('  • Git commits to main will auto-deploy\n') +
    chalk.white('  • Database changes require migrations\n') +
    chalk.white('  • Monitor Sentry for errors\n'),
    { padding: 1, borderColor: 'green', borderStyle: 'round' }
  ));
}

function updateProductionFlags(config: Config) {
  config.mode = 'production';

  // CI/CD
  config.flags.cicd.enabled = true;
  config.flags.cicd.autoDeploy = true;
  config.flags.cicd.requireTests = true;
  config.flags.cicd.requireLinting = true;

  // Database
  config.flags.database.strategy = 'migrate';
  config.flags.database.autoMigrate = true;
  config.flags.database.backupBeforeMigrate = true;
  config.flags.database.requireMigrations = true;

  // Git
  config.flags.git.requirePR = true;
  config.flags.git.requireReviews = 1;
  config.flags.git.allowDirectPush = false;
  config.flags.git.autoSquash = true;

  // Monitoring
  config.flags.monitoring.performanceMonitoring = true;
  config.flags.monitoring.logLevel = 'info';
  config.flags.monitoring.sentryEnvironment = 'production';

  // Features
  config.flags.features.rateLimiting = true;
  config.flags.features.caching = true;
}

async function revertToDevelopment(config: Config) {
  const confirmed = await confirm({
    message: 'Revert to development mode? (This will disable CI/CD auto-deploy)',
    default: false
  });

  if (!confirmed) return;

  const spinner = ora('Reverting to development mode...').start();

  config.mode = 'development';
  config.flags.cicd.enabled = false;
  config.flags.cicd.autoDeploy = false;
  config.flags.database.strategy = 'push';
  config.flags.git.requirePR = false;
  config.flags.git.allowDirectPush = true;
  config.flags.monitoring.logLevel = 'debug';
  config.flags.monitoring.sentryEnvironment = 'development';
  config.flags.features.rateLimiting = false;
  config.flags.features.caching = false;

  await saveConfig(config);
  spinner.succeed('Reverted to development mode');
}

function formatFlagChanges(config: Config): string {
  const changes = [
    `${chalk.yellow('mode')}: development → ${chalk.green('production')}`,
    `${chalk.yellow('database.strategy')}: push → ${chalk.green('migrate')}`,
    `${chalk.yellow('cicd.enabled')}: false → ${chalk.green('true')}`,
    `${chalk.yellow('cicd.autoDeploy')}: false → ${chalk.green('true')}`,
    `${chalk.yellow('git.requirePR')}: false → ${chalk.green('true')}`,
    `${chalk.yellow('monitoring.logLevel')}: debug → ${chalk.green('info')}`,
    `${chalk.yellow('features.rateLimiting')}: false → ${chalk.green('true')}`,
  ];
  return changes.join('\n');
}

async function generateCICDWorkflows(config: Config) {
  // Generate .github/workflows/deploy.yml based on config flags
  const template = `
name: Deploy

on:
  push:
    branches: [${config.flags.cicd.deployBranch}]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      ${config.flags.cicd.requireLinting ? '- run: bun run lint' : ''}
      ${config.flags.cicd.requireTests ? '- run: bun run test' : ''}
      ${config.flags.database.requireMigrations ? '- run: bun run db:migrate' : ''}
      - name: Deploy to Render
        run: curl -X POST https://api.render.com/deploy/...
  `;

  await Bun.write('.github/workflows/deploy.yml', template);
}

async function deployToProduction(config: Config) {
  // Trigger Render deployments
  for (const service of [config.services.render.apiService, config.services.render.workerService]) {
    if (service?.id) {
      await ofetch(`https://api.render.com/v1/services/${service.id}/deploys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}` }
      });
    }
  }
}

async function runProductionMigrations(config: Config) {
  if (config.flags.database.strategy === 'migrate') {
    await $`doppler run --config prod -- bun run db:migrate`;
  }
}

main().catch((error) => {
  console.error(chalk.red('Launch failed:'), error);
  process.exit(1);
});
```

**What it does (current scope):**
1. Checks if already launched
2. Shows what will change:
   - `db:push` → `db:migrate`
   - Vercel password protection → disabled
3. Confirms with user
4. **Updates configuration:**
   - `launched`: false → true
   - `flags.database.strategy`: "push" → "migrate"
   - `launchedAt`: timestamp
5. Disables Vercel password protection (main URL + branch)
6. Creates initial database migrations (if needed)
7. Saves config
8. Shows success message with next steps

**Simple implementation:**
```typescript
async function launch() {
  const config = await loadConfig();

  if (config.launched) {
    console.log('Already launched!');
    return;
  }

  const confirmed = await confirm({
    message: 'Switch to migrations (db:migrate)? This marks the project as live.',
    default: false
  });

  if (!confirmed) return;

  // Update config
  config.launched = true;
  config.flags.database.strategy = 'migrate';
  config.launchedAt = new Date().toISOString();
  await saveConfig(config);

  // Create migrations
  await $`cd packages/db && bun run db:migrate:create`;

  console.log('✓ Launched! Now using db:migrate for all database changes.');
}
```

**Behavior Changes:**
- **Development** (after init): db:push, local Docker, .env.local
- **Production** (after launch): db:migrate, Render services, Doppler prod

**Why separate from init:**
- Init: Infrastructure provisioning (one-time, ~10-15min)
- Develop: Local development (weeks/months)
- Launch: Production deployment (one-time, ~5-10min)

**Configuration Flags - Mode Comparison:**

| Flag | Development Mode | Production Mode |
|------|------------------|-----------------|
| `mode` | "development" | "production" |
| `database.strategy` | "push" (fast) | "migrate" (safe) |
| `database.autoMigrate` | false | true |
| `database.requireMigrations` | false | true |
| `cicd.enabled` | false | true |
| `cicd.autoDeploy` | false | true (on push to main) |
| `cicd.requireTests` | false | true |
| `cicd.requireLinting` | false | true |
| `git.requirePR` | false | true |
| `git.requireReviews` | 0 | 1+ |
| `git.allowDirectPush` | true | false (main protected) |
| `monitoring.performanceMonitoring` | false | true |
| `monitoring.logLevel` | "debug" | "info" |
| `monitoring.sentryEnvironment` | "development" | "production" |
| `features.rateLimiting` | false | true |
| `features.caching` | false | true |

**How Flags Are Used:**

```typescript
// apps/api/src/config.ts
import { loadConfig } from '@/init/utils/config';

const config = await loadConfig();

// Database strategy
if (config.flags.database.strategy === 'migrate') {
  // Use migrations, require migration files
  await checkMigrationStatus();
} else {
  // Use db:push for fast iteration
}

// Rate limiting
if (config.flags.features.rateLimiting) {
  app.use(rateLimitMiddleware);
}

// Logging
logger.level = config.flags.monitoring.logLevel;

// Sentry environment
Sentry.init({
  environment: config.flags.monitoring.sentryEnvironment
});
```

**Example:**
```bash
# Day 1: Initialize infrastructure
bun run init

# Weeks 1-N: Build your product
bun run local
# ... develop features ...

# Launch day: Go live
bun run launch
# ✅ Migrations created
# ✅ Deployed to Render
# ✅ Production database migrated
# ✅ DNS verified
# ✅ Live at yourdomain.com
```

### Full Implementation Scope

**All Steps (Complete in One Implementation):**

1. Prerequisites check (Bun, Docker, Git, **Doppler CLI required**)
2. Interactive TUI configuration (name, org, domain, environments, service API keys)
3. Monorepo rename (@template → @projectname in packages and imports ONLY)
4. Doppler setup (REQUIRED - create project + environments first)
5. Secret generation (BETTER_AUTH_SECRET, Ed25519 webhook keys → push to Doppler immediately)
6. Cloud service provisioning:
   - Render: Create web services (API, worker), database, Redis
   - Sentry: Create projects (API, web, admin, superadmin), get DSNs
   - Email: Configure provider (Resend/SendGrid/SES)
   - OAuth: Configure providers (Google, GitHub - optional)
7. DNS configuration (instructions + verification)
8. PROJECT_NAME environment variable setup (all .env files + Doppler)
9. Environment file generation (.env.local with secrets + service tokens)
10. Database initialization (Docker + Prisma + offer both db:push and db:migrate)
11. Validation (DB/Redis connection + smoke tests + service connectivity)
12. Documentation generation (INIT_COMPLETE.md with all credentials)
13. Git commit (optional)

**Rationale:** User has chosen full provisioning in single implementation. This transforms a fresh fork into a fully production-ready environment with all services configured.

### File Structure

```
scripts/
├── init/
│   ├── index.ts                    # Main orchestrator (handles init, init:new, init:edit)
│   ├── steps/
│   │   ├── 01-prerequisites.ts     # Enhanced prereq checks (Doppler CLI REQUIRED)
│   │   ├── 02-configure.ts         # Simple TUI with @inquirer/prompts
│   │   ├── 03-rename.ts            # Surgical rename (packages + imports ONLY)
│   │   ├── 04-doppler.ts           # Doppler setup FIRST (create project + envs)
│   │   ├── 05-secrets.ts           # Generate secrets + push to Doppler immediately
│   │   ├── 06-render.ts            # Render service provisioning
│   │   ├── 07-sentry.ts            # Sentry projects + DSNs
│   │   ├── 08-email.ts             # Email provider configuration
│   │   ├── 09-oauth.ts             # OAuth providers (optional)
│   │   ├── 10-dns.ts               # DNS configuration + verification
│   │   ├── 11-project-name.ts      # Set PROJECT_NAME in env files + Doppler
│   │   ├── 12-environment.ts       # Create .env files with all secrets/tokens
│   │   ├── 13-database.ts          # Docker + Prisma + seed (offer push/migrate)
│   │   ├── 14-validate.ts          # Health checks + service connectivity
│   │   └── 15-finalize.ts          # Docs + git commit
│   ├── utils/
│   │   ├── prompt.ts               # @inquirer/prompts wrapper (simple TUI)
│   │   ├── config.ts               # init-config.json management
│   │   ├── secrets.ts              # Node crypto utilities
│   │   ├── rename.ts               # Package/import renaming logic (re-runnable)
│   │   ├── ui.ts                   # ora, chalk, boxen
│   │   ├── validation.ts           # Validation helpers
│   │   ├── render.ts               # Render API client (ofetch)
│   │   ├── sentry.ts               # Sentry API client (ofetch)
│   │   └── doppler.ts              # Doppler API client
│   └── templates/
│       ├── INIT_COMPLETE.md.hbs    # Handlebars template
│       ├── render.yaml.hbs         # Render service definitions
│       └── env-comments.ts         # Comments for secrets
└── setup/
    └── (existing scripts - reuse as-is)
```

### Step-by-Step Flow

#### 1. Prerequisites (`01-prerequisites.ts`)
**Reuse:** Extend `check-prereqs.sh`

```typescript
- Check Bun installed (version 1.0+)
- Check Docker installed and daemon running
- Check Git installed
- Verify git working tree is clean (or offer to stash)
- Check if init-config.json exists (detect resume vs new init)
- Check Doppler CLI (required, not optional)
```

#### 2. Interactive Configuration (`02-configure.ts`)
**Navigation-based TUI with progress indicators**

```typescript
import { input, password, checkbox, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';

type StepStatus = 'required' | 'optional' | 'partial' | 'done';

type Step = {
  id: string;
  number: number;
  name: string;
  status: StepStatus;
  required: boolean;
  fn: (config: Config) => Promise<Partial<Config>>;
};

async function gatherConfiguration(existingConfig?: Config): Promise<Config> {
  let config: Config = existingConfig || createDefaultConfig();

  const steps: Step[] = [
    { id: 'project', number: 1, name: 'Project Basics', status: 'required', required: true, fn: configureProject },
    { id: 'environments', number: 2, name: 'Environments', status: 'required', required: true, fn: configureEnvironments },
    { id: 'render', number: 3, name: 'Render (Database, Redis)', status: 'required', required: true, fn: configureRender },
    { id: 'sentry', number: 4, name: 'Sentry (Error Tracking)', status: 'required', required: true, fn: configureSentry },
    { id: 'email', number: 5, name: 'Email Provider', status: 'optional', required: false, fn: configureEmail },
    { id: 'oauth', number: 6, name: 'OAuth Providers', status: 'optional', required: false, fn: configureOAuth },
    { id: 'review', number: 7, name: 'Review & Confirm', status: 'required', required: true, fn: reviewConfig },
  ];

  // Main navigation loop
  while (true) {
    // Update step statuses based on config
    updateStepStatuses(steps, config);

    // Show main menu
    const action = await showMainMenu(steps, config);

    if (action === 'exit') {
      // Warn about incomplete steps but allow exit (resume later)
      const incomplete = steps.filter(s => s.required && s.status !== 'done');
      if (incomplete.length > 0) {
        console.log(chalk.yellow('\n⚠️  Incomplete required steps:'));
        incomplete.forEach(s => console.log(chalk.yellow(`  • ${s.name}`)));
        console.log(chalk.dim('\nYou can exit and resume later with `bun run init`\n'));

        const confirmExit = await confirm({
          message: 'Exit anyway?',
          default: false
        });

        if (!confirmExit) continue;
      }
      break;
    }

    // Navigate to step
    const step = steps.find(s => s.id === action);
    if (!step) continue;

    console.clear();
    console.log(chalk.bold.cyan(`\n${step.number}. ${step.name}\n`));

    try {
      const updates = await step.fn(config);
      Object.assign(config, updates);

      // Show action menu
      const nextAction = await select({
        message: 'What next?',
        choices: [
          { name: '← Back to menu', value: 'menu' },
          { name: '✓ Save & back to menu', value: 'save-menu' },
          { name: '→ Save & next step', value: 'save-next', disabled: step.number === steps.length },
        ]
      });

      if (nextAction === 'save-menu' || nextAction === 'save-next') {
        await saveConfig(config);
        if (nextAction === 'save-next') {
          // Continue to next step
          const nextStep = steps[step.number]; // number is 1-indexed, array is 0-indexed
          if (nextStep) {
            action = nextStep.id;
            continue; // Skip back to loop, will show next step
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('Error in step:'), error);
      await confirm({ message: 'Press enter to continue...', default: true });
    }
  }

  return config;
}

async function showMainMenu(steps: Step[], config: Config): Promise<string> {
  console.clear();
  console.log(chalk.bold.cyan('\n🚀 Project Initialization\n'));

  if (config.project?.name) {
    console.log(chalk.dim(`Project: ${config.project.name}\n`));
  }

  const choices = steps.map(step => ({
    name: formatStepChoice(step),
    value: step.id
  }));

  choices.push(
    { name: chalk.dim('─'.repeat(50)), value: 'separator', disabled: true },
    { name: '✓ Exit (if complete)', value: 'exit' }
  );

  return select({
    message: 'Select a step to configure:',
    choices,
    loop: false
  });
}

function formatStepChoice(step: Step, config: Config): string {
  const icons = {
    required: chalk.red('○'),    // Empty circle - not done
    optional: chalk.dim('-'),     // Dash - optional
    partial: chalk.yellow('◐'),   // Half circle - in progress
    done: chalk.green('✓')        // Check - complete
  };

  const icon = icons[step.status];
  const num = chalk.dim(`${step.number}.`);
  const name = step.status === 'done' ? chalk.dim(step.name) : step.name;
  const tag = step.required ? '' : chalk.dim(' (optional)');

  // Show last 4 digits if key is configured
  let keyHint = '';
  if (step.id === 'render' && config.services?.render?.apiKeyLast4) {
    keyHint = chalk.dim(` [•••${config.services.render.apiKeyLast4}]`);
  } else if (step.id === 'sentry' && config.services?.sentry?.authTokenLast4) {
    keyHint = chalk.dim(` [•••${config.services.sentry.authTokenLast4}]`);
  } else if (step.id === 'email' && config.services?.email?.apiKeyLast4) {
    keyHint = chalk.dim(` [•••${config.services.email.apiKeyLast4}]`);
  }

  return `${icon} ${num} ${name}${tag}${keyHint}`;
}

function updateStepStatuses(steps: Step[], config: Config) {
  // Project step
  const projectStep = steps.find(s => s.id === 'project');
  if (projectStep) {
    if (config.project?.name && config.project?.domain && config.project?.organization) {
      projectStep.status = 'done';
    } else if (config.project?.name) {
      projectStep.status = 'partial';
    } else {
      projectStep.status = 'required';
    }
  }

  // Environments
  const envStep = steps.find(s => s.id === 'environments');
  if (envStep) {
    envStep.status = config.environments?.length > 0 ? 'done' : 'required';
  }

  // Render
  const renderStep = steps.find(s => s.id === 'render');
  if (renderStep) {
    renderStep.status = config.services?.render?.keysConfigured ? 'done' : 'required';
  }

  // Sentry
  const sentryStep = steps.find(s => s.id === 'sentry');
  if (sentryStep) {
    sentryStep.status = config.services?.sentry?.keysConfigured ? 'done' : 'required';
  }

  // Email (optional)
  const emailStep = steps.find(s => s.id === 'email');
  if (emailStep) {
    if (config.services?.email?.provider === 'skip') {
      emailStep.status = 'done'; // Skipped counts as done
    } else if (config.services?.email?.keysConfigured) {
      emailStep.status = 'done';
    } else {
      emailStep.status = 'optional';
    }
  }

  // OAuth (optional)
  const oauthStep = steps.find(s => s.id === 'oauth');
  if (oauthStep) {
    oauthStep.status = config.setupOAuth !== undefined ? 'done' : 'optional';
  }

  // Review
  const reviewStep = steps.find(s => s.id === 'review');
  if (reviewStep) {
    const allRequired = steps.filter(s => s.required && s.id !== 'review');
    const allDone = allRequired.every(s => s.status === 'done');
    reviewStep.status = allDone ? 'required' : 'partial';
  }
}

// Individual step functions
async function configureProject(config: Config): Promise<Partial<Config>> {
  const project = {
    name: await input({
      message: 'Project name (lowercase, no spaces):',
      default: config.project?.name || basename(process.cwd()),
      validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Must be lowercase alphanumeric'
    }),
    organization: await input({
      message: 'Organization name:',
      default: config.project?.organization || 'Your Organization'
    }),
    domain: await input({
      message: 'Primary domain (e.g., myapp.com):',
      default: config.project?.domain,
      validate: (v) => /^[a-z0-9-]+\.[a-z]{2,}$/.test(v) || 'Must be valid domain'
    }),
  };

  return { project };
}

async function configureEnvironments(config: Config): Promise<Partial<Config>> {
  const environments = await checkbox({
    message: 'Select environments to provision:',
    choices: [
      { name: 'dev', value: 'dev', checked: config.environments?.includes('dev') ?? true },
      { name: 'staging', value: 'staging', checked: config.environments?.includes('staging') ?? true },
      { name: 'sandbox', value: 'sandbox', checked: config.environments?.includes('sandbox') ?? false },
      { name: 'prod', value: 'prod', checked: config.environments?.includes('prod') ?? true }
    ],
    validate: (v) => v.length > 0 || 'Select at least one environment'
  });

  return { environments };
}

async function configureRender(config: Config): Promise<Partial<Config>> {
  console.log(chalk.dim('Get your API key from: https://dashboard.render.com/u/settings\n'));

  const apiKey = await password({
    message: 'Render API key:',
    validate: (v) => v.length > 0 || 'API key required'
  });

  // Extract last 4 characters for display (sanitized)
  const apiKeyLast4 = apiKey.slice(-4);

  // Show confirmation with sanitized key
  console.log(chalk.green(`\n✓ API key saved: ${'•'.repeat(apiKey.length - 4)}${apiKeyLast4}\n`));

  // Store last 4 digits and flag, actual key goes to Doppler
  return {
    services: {
      ...config.services,
      render: {
        ...config.services?.render,
        keysConfigured: true,
        apiKeyLast4,
        dopplerConfigured: false,
        localConfigured: false
      }
    }
  };
}

// ... similar functions for sentry, email, oauth, review
```

#### 3. Monorepo Rename (`03-rename.ts`) - SURGICAL APPROACH
**Philosophy:** Only replace package names and import paths. Everything else uses PROJECT_NAME env var.

**Re-runnable:** Supports template → name1 → name2 by detecting current project name.

```typescript
import { existsSync } from 'fs';
import { $ } from 'bun';

async function detectCurrentProjectName(): Promise<string> {
  // Try init-config.json first
  if (existsSync('init-config.json')) {
    const config = JSON.parse(await Bun.file('init-config.json').text());
    return config.project.name;
  }

  // Fallback: read from root package.json
  const rootPkg = JSON.parse(await Bun.file('package.json').text());
  return rootPkg.name;
}

async function renameMonorepo(newProjectName: string) {
  const spinner = ora('Renaming monorepo packages...').start();

  // Detect current name (template, or previous init name)
  const currentName = await detectCurrentProjectName();
  spinner.text = `Renaming from "${currentName}" to "${newProjectName}"...`;

  // STEP 1: Update 10 package.json files
  const pkgFiles = [
    'package.json',
    'packages/db/package.json',
    'packages/ui/package.json',
    'packages/shared/package.json',
    'packages/email/package.json',
    'packages/permissions/package.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'apps/admin/package.json',
    'apps/superadmin/package.json',
  ];

  for (const file of pkgFiles) {
    const pkg = JSON.parse(await Bun.file(file).text());

    // Replace package name (handles both "template" and "@template/pkg")
    if (pkg.name === currentName) {
      pkg.name = newProjectName;
    } else if (pkg.name.startsWith(`@${currentName}/`)) {
      pkg.name = pkg.name.replace(`@${currentName}/`, `@${newProjectName}/`);
    }

    await Bun.write(file, JSON.stringify(pkg, null, 2));
  }

  // STEP 2: Update imports in all TS/TSX files
  // Use regex that matches current name, not hardcoded "template"
  spinner.text = 'Updating TypeScript imports...';

  const importRegex = new RegExp(`@${currentName}/`, 'g');
  await replaceInFiles({
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    from: importRegex,
    to: `@${newProjectName}/`
  });

  // STEP 3: Regenerate lockfile
  spinner.text = 'Regenerating lockfile...';
  await $`bun install`;

  spinner.succeed(`Renamed from "${currentName}" to "${newProjectName}"`);
}

// Helper function for file replacement
async function replaceInFiles(options: {
  files: string[],
  from: RegExp,
  to: string
}) {
  const { glob } = await import('glob');
  const allFiles = await glob(options.files);

  for (const file of allFiles) {
    const content = await Bun.file(file).text();
    const updated = content.replace(options.from, options.to);
    if (content !== updated) {
      await Bun.write(file, updated);
    }
  }
}
```

**What this DOESN'T touch (uses PROJECT_NAME instead):**
- ❌ docker-compose.yml (uses `${PROJECT_NAME:-template}`)
- ❌ .env* files DATABASE_URL (uses `${PROJECT_NAME}`)
- ❌ doppler.config.ts (uses `PROJECT_NAME` env var)
- ❌ OTEL_SERVICE_NAME (uses `${PROJECT_NAME}-api`)
- ❌ Container names, database names, service names (all use env var)

#### 4. Doppler Setup (`04-doppler.ts`) - REQUIRED FIRST
**Reuse:** `dopplerSetup.ts` to create project structure

**Why first:** Need Doppler ready to receive secrets immediately after generation

```typescript
const spinner = ora('Setting up Doppler...').start();

// Create Doppler project + environments
spinner.text = 'Creating Doppler project...';
await $`bun ./scripts/setup/dopplerSetup.ts`;

spinner.text = 'Verifying Doppler environments...';
for (const env of config.environments) {
  await verifyDopplerEnv(config.projectName, env);
}

spinner.succeed('Doppler project ready');
```

#### 5. Secret Generation (`05-secrets.ts`)
**Using Node crypto module, push to Doppler immediately**

```typescript
import crypto from 'node:crypto';

const spinner = ora('Generating secrets...').start();

// Generate secrets
const secrets = {
  BETTER_AUTH_SECRET: crypto.randomBytes(32).toString('base64'),
  ...generateWebhookKeys()
};

function generateWebhookKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  return {
    WEBHOOK_SIGNING_PRIVATE_KEY: privateKey,
    WEBHOOK_SIGNING_PUBLIC_KEY: publicKey
  };
}

// Push to Doppler immediately (Doppler was set up in step 4)
spinner.text = 'Pushing secrets to Doppler...';
for (const env of config.environments) {
  await pushToDoppler(env, secrets);
}

spinner.succeed('Secrets generated and stored in Doppler');

return secrets;
```

#### 6. Render Provisioning (`06-render.ts`)
**Create web services, database, Redis**

```typescript
import { ofetch } from 'ofetch';

const renderApi = ofetch.create({
  baseURL: 'https://api.render.com/v1',
  headers: { Authorization: `Bearer ${config.renderApiKey}` }
});

const spinner = ora('Provisioning Render services...').start();

// Create PostgreSQL database
spinner.text = 'Creating PostgreSQL database...';
const database = await renderApi('/postgres', {
  method: 'POST',
  body: {
    name: `${config.projectName}-db`,
    region: 'oregon',
    plan: 'starter', // Free tier
    databaseName: config.projectName,
    databaseUser: config.projectName,
  }
});

// Create Redis instance
spinner.text = 'Creating Redis instance...';
const redis = await renderApi('/redis', {
  method: 'POST',
  body: {
    name: `${config.projectName}-redis`,
    region: 'oregon',
    plan: 'starter',
  }
});

// Create API web service
spinner.text = 'Creating API service...';
const apiService = await renderApi('/services', {
  method: 'POST',
  body: {
    type: 'web_service',
    name: `${config.projectName}-api`,
    env: 'docker',
    region: 'oregon',
    plan: 'starter',
    envVars: [
      { key: 'DATABASE_URL', value: database.connectionString },
      { key: 'REDIS_URL', value: redis.connectionString },
      // Doppler will provide other secrets
    ],
    autoDeploy: true,
  }
});

// Create background worker
spinner.text = 'Creating worker service...';
const workerService = await renderApi('/services', {
  method: 'POST',
  body: {
    type: 'background_worker',
    name: `${config.projectName}-worker`,
    env: 'docker',
    region: 'oregon',
    plan: 'starter',
    envVars: [
      { key: 'DATABASE_URL', value: database.connectionString },
      { key: 'REDIS_URL', value: redis.connectionString },
    ],
  }
});

// Update Doppler with Render URLs
await pushToDoppler('dev', {
  DATABASE_URL: database.connectionString,
  REDIS_URL: redis.connectionString,
  API_URL: `https://${apiService.service.slug}.onrender.com`,
});

spinner.succeed('Render services provisioned');

return { database, redis, apiService, workerService };
```

#### 7. Sentry Setup (`07-sentry.ts`)
**Create projects for each app, get DSNs**

```typescript
import { ofetch } from 'ofetch';

const sentryApi = ofetch.create({
  baseURL: 'https://sentry.io/api/0',
  headers: { Authorization: `Bearer ${config.sentryAuthToken}` }
});

const spinner = ora('Setting up Sentry...').start();

const apps = ['api', 'web', 'admin', 'superadmin'];
const dsns = {};

for (const app of apps) {
  spinner.text = `Creating Sentry project: ${config.projectName}-${app}...`;

  const project = await sentryApi(`/organizations/${config.sentryOrganization}/projects/`, {
    method: 'POST',
    body: {
      name: `${config.projectName}-${app}`,
      platform: app === 'api' ? 'node' : 'react',
    }
  });

  // Get client keys (DSN)
  const keys = await sentryApi(`/projects/${config.sentryOrganization}/${project.slug}/keys/`);
  dsns[app] = keys[0].dsn.public;
}

// Push DSNs to Doppler
for (const env of config.environments) {
  await pushToDoppler(env, {
    SENTRY_DSN_API: dsns.api,
    SENTRY_DSN_WEB: dsns.web,
    SENTRY_DSN_ADMIN: dsns.admin,
    SENTRY_DSN_SUPERADMIN: dsns.superadmin,
  });
}

spinner.succeed('Sentry configured');

return dsns;
```

#### 8. Email Provider Setup (`08-email.ts`)

```typescript
async function setupEmailProvider(config: Config) {
  if (config.emailProvider === 'skip') {
    console.log('⏭️  Skipping email provider setup');
    return;
  }

  const spinner = ora(`Configuring ${config.emailProvider}...`).start();

  // Verify API key works
  await verifyEmailProvider(config.emailProvider, config.emailApiKey);

  // Push to Doppler
  for (const env of config.environments) {
    await pushToDoppler(env, {
      EMAIL_PROVIDER: config.emailProvider,
      EMAIL_API_KEY: config.emailApiKey,
      EMAIL_FROM: `noreply@${config.domain}`,
    });
  }

  spinner.succeed(`${config.emailProvider} configured`);

  // Show DNS instructions
  console.log(boxen(
    `📧 Email DNS Records\n\n` +
    `Add these records to ${config.domain}:\n` +
    getDNSInstructions(config.emailProvider),
    { padding: 1, borderColor: 'yellow' }
  ));
}
```

#### 9. OAuth Setup (`09-oauth.ts`) - OPTIONAL

```typescript
async function setupOAuth(config: Config) {
  if (!config.setupOAuth) {
    console.log('⏭️  Skipping OAuth setup');
    return;
  }

  // Guide user through OAuth provider setup
  console.log(boxen(
    `🔐 OAuth Setup\n\n` +
    `For each provider, create an OAuth app and get credentials.\n\n` +
    `Google: https://console.cloud.google.com/apis/credentials\n` +
    `GitHub: https://github.com/settings/developers`,
    { padding: 1, borderColor: 'cyan' }
  ));

  const providers = await checkbox({
    message: 'Which OAuth providers?',
    choices: ['google', 'github', 'apple', 'microsoft']
  });

  const oauthCreds = {};

  for (const provider of providers) {
    const clientId = await input({ message: `${provider} Client ID:` });
    const clientSecret = await password({ message: `${provider} Client Secret:` });
    oauthCreds[provider] = { clientId, clientSecret };
  }

  // Push to Doppler
  for (const env of config.environments) {
    const secrets = {};
    for (const [provider, creds] of Object.entries(oauthCreds)) {
      secrets[`${provider.toUpperCase()}_CLIENT_ID`] = creds.clientId;
      secrets[`${provider.toUpperCase()}_CLIENT_SECRET`] = creds.clientSecret;
    }
    await pushToDoppler(env, secrets);
  }

  console.log('✅ OAuth providers configured');
}
```

#### 10. DNS Configuration (`10-dns.ts`)

```typescript
async function configureDNS(config: Config, services: RenderServices) {
  console.log(boxen(
    `🌐 DNS Configuration\n\n` +
    `Add these records to your DNS provider:\n\n` +
    `A/CNAME Records:\n` +
    `  ${config.domain} → ${services.apiService.slug}.onrender.com\n` +
    `  api.${config.domain} → ${services.apiService.slug}.onrender.com\n` +
    `  admin.${config.domain} → ${services.webService.slug}.onrender.com\n\n` +
    `Email Records:\n` +
    `  (See email provider instructions above)`,
    { padding: 1, borderColor: 'blue' }
  ));

  const configured = await confirm({
    message: 'Have you configured DNS records?',
    default: false
  });

  if (configured) {
    const spinner = ora('Verifying DNS propagation...').start();
    await verifyDNS(config.domain);
    spinner.succeed('DNS verified');
  } else {
    console.warn('⚠️  DNS not configured. Configure later and restart services.');
  }
}
```

#### 11. PROJECT_NAME Setup (`11-project-name.ts`)
**Set PROJECT_NAME env var everywhere for runtime configuration**

```typescript
const spinner = ora('Configuring PROJECT_NAME...').start();

// Update docker-compose.yml to use env var
spinner.text = 'Updating docker-compose.yml...';
await updateDockerCompose(config.projectName);

// Set PROJECT_NAME in all .env files
const envFiles = [
  'apps/api/.env.local',
  'apps/web/.env.local',
  'apps/admin/.env.local',
  'apps/superadmin/.env.local',
];

for (const file of envFiles) {
  if (existsSync(file)) {
    await appendEnvVar(file, 'PROJECT_NAME', config.projectName);
  }
}

// Push PROJECT_NAME to Doppler for all environments
spinner.text = 'Pushing PROJECT_NAME to Doppler...';
for (const env of config.environments) {
  await pushToDoppler(env, { PROJECT_NAME: config.projectName });
}

spinner.succeed('PROJECT_NAME configured');

async function updateDockerCompose(projectName: string) {
  // Ensure docker-compose.yml uses ${PROJECT_NAME:-template} pattern
  const compose = await Bun.file('docker-compose.yml').text();

  // Verify it has the env var pattern (should already be in template)
  if (!compose.includes('${PROJECT_NAME:-template}')) {
    throw new Error('docker-compose.yml missing PROJECT_NAME env var pattern');
  }

  // No changes needed - docker-compose.yml already uses env vars
  // This is just a verification step
}

async function appendEnvVar(file: string, key: string, value: string) {
  let content = await Bun.file(file).text();

  // Remove existing PROJECT_NAME if present
  content = content.replace(/^PROJECT_NAME=.*$/m, '');

  // Append new value
  if (!content.endsWith('\n')) content += '\n';
  content += `PROJECT_NAME=${value}\n`;

  await Bun.write(file, content);
}
```

#### 12. Environment Files (`12-environment.ts`)
**Reuse:** `sync-env.sh` for initial setup

```typescript
const spinner = ora('Creating environment files...').start();

// Copy .env.example → .env.local
await $`./scripts/setup/sync-env.sh`;

// Files are now ready with PROJECT_NAME from step 11
// Secrets are already in Doppler from step 5

spinner.succeed('Environment files created');
```

#### 13. Database Setup (`13-database.ts`)
**Reuse:** Logic from `setup.sh`, use --migrate flag to choose strategy

```typescript
async function setupDatabase(config: Config, useMigrate: boolean) {
  const spinner = ora('Setting up database...').start();

  // Start Docker (will use PROJECT_NAME from .env)
  spinner.text = 'Starting Docker containers...';
  await $`docker-compose up -d`;

  // Wait for health checks
  spinner.text = 'Waiting for PostgreSQL...';
  await $`./scripts/setup/wait-postgres.sh`;

  spinner.text = 'Waiting for Redis...';
  await $`./scripts/setup/wait-redis.sh`;

  // Prisma
  spinner.text = 'Generating Prisma client...';
  await $`bun run db:generate`;

  // Use flag to determine strategy
  if (useMigrate) {
    spinner.text = 'Running database migrations...';
    await $`bun run db:migrate`;
    console.log(chalk.dim('  Using db:migrate for version-controlled schema changes'));
  } else {
    spinner.text = 'Pushing schema to database...';
    await $`bun run db:push`;
    console.log(chalk.dim('  Using db:push for fast development setup'));
  }

  spinner.text = 'Seeding database with test data...';
  await $`bun run db:seed --prime`.nothrow();

  spinner.succeed(`Database ready (${useMigrate ? 'migrate' : 'push'} strategy)`);
}
```

#### 14. Validation (`14-validate.ts`)
```typescript
const spinner = ora('Validating setup...').start();

// Test database connection
spinner.text = 'Testing database connection...';
await checkDatabaseConnection();

// Test Redis connection
spinner.text = 'Testing Redis connection...';
await checkRedisConnection();

// Run smoke tests
spinner.text = 'Running smoke tests...';
await $`bun test packages/db/src/test/factory.test.ts`;

spinner.succeed('All validations passed');
```

#### 15. Finalize (`15-finalize.ts`)
```typescript
const spinner = ora('Finalizing...').start();

// Generate INIT_COMPLETE.md
spinner.text = 'Generating documentation...';
const docs = renderTemplate('INIT_COMPLETE.md.hbs', {
  projectName: config.project.name,
  organizationName: config.project.organization,
  domain: config.project.domain,
  environments: config.environments,
  services: config.services,
  nextSteps: [
    'Run `bun run local` to start development',
    'Visit http://localhost:3000',
    'Check INIT_COMPLETE.md for all credentials and next steps'
  ]
});
await Bun.write('INIT_COMPLETE.md', docs);

spinner.succeed('Initialization complete!');

// Git commit (optional)
const shouldCommit = await confirm({
  message: 'Create git commit for initialization?',
  default: true
});

if (shouldCommit) {
  await $`git add .`;
  await $`git commit -m "chore: initialize ${config.project.name}\n\nAutomated initialization:\n- Renamed packages from @template to @${config.project.name}\n- Configured Doppler with secrets\n- Provisioned cloud services (Render, Sentry)\n- Set up local development environment\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`;
}

// Success message
console.log('\n' + boxen(
  chalk.bold.green(`🎉 ${config.project.name} initialized!\n\n`) +
  chalk.dim('Next steps:\n') +
  chalk.cyan('  bun run local') + chalk.dim(' - Start development\n') +
  chalk.cyan('  cat INIT_COMPLETE.md') + chalk.dim(' - View credentials\n'),
  { padding: 1, borderColor: 'green', borderStyle: 'round' }
));
```

### Progress & Resume Capability

**Config File Structure** (`init-config.json`):
```json
{
  "version": "1.0",
  "project": {
    "name": "myproject",
    "organization": "My Organization",
    "domain": "myproject.com"
  },
  "environments": ["dev", "staging", "prod"],
  "services": {
    "render": {
      "keysConfigured": true,
      "apiKeyLast4": "a7f3",
      "dopplerConfigured": true,
      "localConfigured": false,
      "database": {
        "id": "dpg-abc123",
        "name": "myproject-db",
        "connectionString": "postgresql://..."
      },
      "redis": {
        "id": "red-abc123",
        "name": "myproject-redis",
        "connectionString": "redis://..."
      },
      "apiService": {
        "id": "srv-abc123",
        "name": "myproject-api",
        "url": "https://myproject-api.onrender.com"
      },
      "workerService": {
        "id": "srv-def456",
        "name": "myproject-worker"
      }
    },
    "sentry": {
      "keysConfigured": true,
      "authTokenLast4": "b8k2",
      "dopplerConfigured": true,
      "localConfigured": true,
      "organization": "my-org",
      "dsns": {
        "api": "https://abc123@o123.ingest.sentry.io/456",
        "web": "https://def456@o123.ingest.sentry.io/789",
        "admin": "https://ghi789@o123.ingest.sentry.io/012",
        "superadmin": "https://jkl012@o123.ingest.sentry.io/345"
      }
    },
    "email": {
      "provider": "resend",
      "keysConfigured": true,
      "apiKeyLast4": "c9m7",
      "dopplerConfigured": true,
      "localConfigured": true
    },
    "doppler": {
      "projectConfigured": true,
      "secretsPushed": true,
      "environments": ["dev", "staging", "prod"]
    }
  },
  "setupOAuth": false,
  "launched": false,
  "launchedAt": null,
  "flags": {
    "cicd": {
      "enabled": false,
      "autoDeploy": false,
      "requireTests": false,
      "requireLinting": false,
      "deployBranch": "main",
      "protectedBranches": ["main"]
    },
    "database": {
      "strategy": "push",
      "autoMigrate": false,
      "backupBeforeMigrate": false,
      "requireMigrations": false
    },
    "git": {
      "requirePR": false,
      "requireReviews": 0,
      "allowDirectPush": true,
      "autoSquash": false
    },
    "monitoring": {
      "errorTracking": true,
      "performanceMonitoring": false,
      "logLevel": "debug",
      "sentryEnabled": true,
      "sentryEnvironment": "development"
    },
    "features": {
      "rateLimiting": false,
      "caching": false,
      "websockets": true
    }
  }
}
```

**Security Note:** API keys and secrets are NEVER stored in `init-config.json`. Only:
- ✅ Boolean flags indicating configuration status
- ✅ Non-sensitive metadata (service IDs, URLs, organization names)
- ✅ Public values (DSNs, connection strings with credentials in Doppler)
- ❌ API keys, auth tokens, or secrets

**Config File Management:**
- ✅ **COMMITTED TO GIT** - init-config.json IS committed and shared across all developers
- ✅ **ONE CONFIG FILE** - Single source of truth for the entire project
- ✅ Single config for all environments (mode switching instead of multiple configs)
- ✅ Validated with Zod schema on load
- ✅ Some fields have defaults, some are required (must complete init)
- ✅ **No progress tracking array** - Resume detection based on what values exist
  - If `services.render.database` exists → render step complete
  - If `services.sentry.dsns` exists → sentry step complete
  - Much simpler than tracking completed steps

**Required Fields (No Defaults):**
- `project.name` - Must be provided during init
- `project.organization` - Must be provided
- `project.domain` - Must be provided
- `environments` - Must select at least one
- `services.*` - All service configurations required

**Optional Fields (Have Defaults):**
- `mode` - Defaults to "development"
- `flags.cicd.*` - All default to false/safe values
- `flags.database.strategy` - Defaults to "push"
- `flags.monitoring.logLevel` - Defaults to "debug"
- `flags.features.*` - Most default to false (opt-in)

**Config Management** (`utils/config.ts`):
```typescript
import { existsSync } from 'fs';
import { z } from 'zod';

// Zod schema for validation
const ConfigSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string().min(1),
    organization: z.string().min(1),
    domain: z.string().regex(/^[a-z0-9-]+\.[a-z]{2,}$/)
  }),
  environments: z.array(z.enum(['dev', 'staging', 'sandbox', 'prod'])).min(1),
  services: z.object({
    render: z.object({
      keysConfigured: z.boolean(),
      apiKeyLast4: z.string().length(4).optional(),
      dopplerConfigured: z.boolean(),
      localConfigured: z.boolean(),
      database: z.object({
        id: z.string(),
        name: z.string(),
        connectionString: z.string()
      }).optional(),
      redis: z.object({
        id: z.string(),
        name: z.string(),
        connectionString: z.string()
      }).optional(),
      apiService: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().url()
      }).optional(),
      workerService: z.object({
        id: z.string(),
        name: z.string()
      }).optional()
    }),
    sentry: z.object({
      keysConfigured: z.boolean(),
      authTokenLast4: z.string().length(4).optional(),
      dopplerConfigured: z.boolean(),
      localConfigured: z.boolean(),
      organization: z.string(),
      dsns: z.object({
        api: z.string().url(),
        web: z.string().url(),
        admin: z.string().url(),
        superadmin: z.string().url()
      }).optional()
    }),
    email: z.object({
      provider: z.enum(['resend', 'sendgrid', 'ses', 'skip']),
      keysConfigured: z.boolean(),
      apiKeyLast4: z.string().length(4).optional(),
      dopplerConfigured: z.boolean(),
      localConfigured: z.boolean()
    }),
    doppler: z.object({
      projectConfigured: z.boolean(),
      secretsPushed: z.boolean(),
      environments: z.array(z.string())
    })
  }),
  setupOAuth: z.boolean(),
  launched: z.boolean().default(false),
  launchedAt: z.string().datetime().nullable(),
  flags: z.object({
    cicd: z.object({
      enabled: z.boolean().default(false),
      autoDeploy: z.boolean().default(false),
      requireTests: z.boolean().default(false),
      requireLinting: z.boolean().default(false),
      deployBranch: z.string().default('main'),
      protectedBranches: z.array(z.string()).default(['main'])
    }),
    database: z.object({
      strategy: z.enum(['push', 'migrate']).default('push'),
      autoMigrate: z.boolean().default(false),
      backupBeforeMigrate: z.boolean().default(false),
      requireMigrations: z.boolean().default(false)
    }),
    git: z.object({
      requirePR: z.boolean().default(false),
      requireReviews: z.number().int().min(0).default(0),
      allowDirectPush: z.boolean().default(true),
      autoSquash: z.boolean().default(false)
    }),
    monitoring: z.object({
      errorTracking: z.boolean().default(true),
      performanceMonitoring: z.boolean().default(false),
      logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
      sentryEnabled: z.boolean().default(true),
      sentryEnvironment: z.enum(['development', 'staging', 'production']).default('development')
    }),
    features: z.object({
      rateLimiting: z.boolean().default(false),
      caching: z.boolean().default(false),
      websockets: z.boolean().default(true)
    })
  })
});

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_FILE = 'init-config.json';

export async function loadConfig(): Promise<Config | null> {
  if (!existsSync(CONFIG_FILE)) return null;

  const raw = JSON.parse(await Bun.file(CONFIG_FILE).text());

  // Validate with Zod (throws if invalid)
  const config = ConfigSchema.parse(raw);

  return config;
}

export async function loadConfigOrThrow(): Promise<Config> {
  const config = await loadConfig();
  if (!config) {
    throw new Error('No init-config.json found. Run `bun run init` first.');
  }
  return config;
}

export async function saveConfig(config: Config) {
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function updateConfig(data: Partial<Config>) {
  const config = await loadConfig();
  if (!config) throw new Error('No config found');

  // Merge data into config (e.g., Render service metadata)
  // Note: This merges NON-SENSITIVE data only (service IDs, URLs, etc.)
  // API keys and secrets are NEVER stored in config
  Object.assign(config, data);

  await saveConfig(config);
}

// Check if a step is complete by evaluating what data exists
export function isStepComplete(config: Config, stepName: string): boolean {
  switch (stepName) {
    case 'configure':
      return !!config.project.name && !!config.project.domain;
    case 'rename':
      return !!config.project.name; // Rename depends on having project name
    case 'doppler':
      return config.services.doppler.projectConfigured;
    case 'secrets':
      return config.services.doppler.secretsPushed;
    case 'render':
      return !!config.services.render.database?.id;
    case 'sentry':
      return !!config.services.sentry.dsns?.api;
    case 'email':
      return config.services.email.keysConfigured;
    // ... etc. Evaluate based on what data exists
    default:
      return false;
  }
}

/**
 * Security helper: Prompt for API key during init:edit
 * Keys are never pre-filled from config
 */
export async function promptForKey(serviceName: string, keyType: string): Promise<string> {
  const { password } = await import('@inquirer/prompts');
  return password({
    message: `${serviceName} ${keyType} (not stored in config):`,
    validate: (v) => v.length > 0 || 'Required'
  });
}
```

**Main Orchestrator** (`scripts/init/index.ts`):
```typescript
#!/usr/bin/env bun
import { existsSync } from 'fs';
import { loadConfig, saveConfig, updateConfig, isStepComplete } from './utils/config';
import { gatherConfiguration } from './steps/02-configure';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

// Parse CLI args
const args = process.argv.slice(2);
const command = args.find(arg => !arg.startsWith('--')) || 'init';
const useMigrate = args.includes('--migrate');

async function main() {
  let config = await loadConfig();

  // Show flag info
  if (useMigrate) {
    console.log(chalk.cyan('🗄️  Using db:migrate strategy (production-ready)'));
  } else {
    console.log(chalk.dim('💨 Using db:push strategy (fast dev setup). Use --migrate for production.'));
  }

  // Handle commands
  if (command === 'init:new') {
    if (config) {
      const confirmed = await confirm({
        message: 'Existing configuration found. Start fresh? (current config will be backed up)',
        default: false
      });

      if (!confirmed) {
        console.log(chalk.yellow('Cancelled.'));
        process.exit(0);
      }

      // Backup existing config
      await Bun.write('init-config.backup.json', JSON.stringify(config, null, 2));
    }

    // Start fresh
    config = null;
  } else if (command === 'init:edit') {
    if (!config) {
      console.log(chalk.red('No existing configuration found. Run `bun run init` first.'));
      process.exit(1);
    }

    // Load TUI with existing values pre-filled
    config = await gatherConfiguration(config);
    await saveConfig(config);

    const rerun = await confirm({
      message: 'Re-run affected steps with new configuration?',
      default: true
    });

    if (!rerun) {
      console.log(chalk.green('Configuration updated.'));
      process.exit(0);
    }

    // Config already saved, steps will check what's missing based on values
    // No need to clear anything - resume detection is value-based
  } else if (command === 'init') {
    // Smart default: resume if config exists, otherwise start new
    if (config) {
      console.log(chalk.cyan(`\n📋 Resuming initialization for "${config.project.name}"...\n`));
    }
  }

  // If no config, gather it
  if (!config) {
    config = await gatherConfiguration();
    await saveConfig(config);
  }

  // Define steps (pass useMigrate flag to database step)
  const steps = [
    { name: 'prerequisites', fn: checkPrerequisites, resumable: false },
    { name: 'configure', fn: () => Promise.resolve(), resumable: true }, // Already done
    { name: 'rename', fn: renameMonorepo, resumable: true },
    { name: 'doppler', fn: setupDoppler, resumable: true },
    { name: 'secrets', fn: generateSecrets, resumable: true },
    { name: 'render', fn: provisionRender, resumable: true },
    { name: 'sentry', fn: setupSentry, resumable: true },
    { name: 'email', fn: setupEmail, resumable: true },
    { name: 'oauth', fn: setupOAuth, resumable: true },
    { name: 'dns', fn: configureDNS, resumable: true },
    { name: 'projectName', fn: setupProjectName, resumable: true },
    { name: 'environment', fn: createEnvironmentFiles, resumable: true },
    { name: 'database', fn: (cfg) => setupDatabase(cfg, useMigrate), resumable: false },
    { name: 'validate', fn: validateSetup, resumable: false },
    { name: 'finalize', fn: finalize, resumable: false },
  ];

  // Execute steps
  for (const step of steps) {
    if (isStepComplete(config, step.name) && step.resumable) {
      console.log(chalk.dim(`⏭️  Skipping ${step.name} (already complete)`));
      continue;
    }

    try {
      const result = await step.fn(config);
      if (result) {
        await updateConfig(result); // Merge step results into config
        config = await loadConfig(); // Reload config with updates
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error in step "${step.name}":`), error);
      console.log(chalk.yellow(`\nConfig saved. Run \`bun run init\` to resume.\n`));
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
```

## Files to Modify

### New Files to Create

**Main Orchestrator:**
- `scripts/init/index.ts` - Entry point (handles init, init:new, init:edit commands)

**Step Implementations:**
- `scripts/init/steps/01-prerequisites.ts` - Enhanced prereq checks (Doppler CLI required)
- `scripts/init/steps/02-configure.ts` - Simple TUI with @inquirer/prompts
- `scripts/init/steps/03-rename.ts` - Surgical rename (packages + imports only, re-runnable)
- `scripts/init/steps/04-doppler.ts` - Doppler setup FIRST (create project + envs)
- `scripts/init/steps/05-secrets.ts` - Generate secrets + push to Doppler immediately
- `scripts/init/steps/06-render.ts` - Render service provisioning
- `scripts/init/steps/07-sentry.ts` - Sentry projects + DSNs
- `scripts/init/steps/08-email.ts` - Email provider configuration
- `scripts/init/steps/09-oauth.ts` - OAuth providers (optional)
- `scripts/init/steps/10-dns.ts` - DNS configuration + verification
- `scripts/init/steps/11-project-name.ts` - Set PROJECT_NAME env var everywhere
- `scripts/init/steps/12-environment.ts` - Create .env files
- `scripts/init/steps/13-database.ts` - Docker + Prisma + seed (offer push/migrate)
- `scripts/init/steps/14-validate.ts` - Health checks + service connectivity
- `scripts/init/steps/15-finalize.ts` - Docs + git commit

**Utilities:**
- `scripts/init/utils/prompt.ts` - @inquirer/prompts wrapper (simple TUI)
- `scripts/init/utils/config.ts` - init-config.json management (replaces progress.ts)
- `scripts/init/utils/secrets.ts` - Node crypto utilities
- `scripts/init/utils/rename.ts` - Package/import renaming logic (re-runnable)
- `scripts/init/utils/ui.ts` - ora, chalk, boxen
- `scripts/init/utils/validation.ts` - Validation helpers
- `scripts/init/utils/render.ts` - Render API client (ofetch)
- `scripts/init/utils/sentry.ts` - Sentry API client (ofetch)
- `scripts/init/utils/doppler.ts` - Doppler API client

**Templates:**
- `scripts/init/templates/INIT_COMPLETE.md.hbs` - Handlebars template

### Existing Files to Modify

**package.json** - Add scripts and dependencies:
```json
{
  "scripts": {
    "init": "bun ./scripts/init/index.ts init",
    "init:new": "bun ./scripts/init/index.ts init:new",
    "init:edit": "bun ./scripts/init/index.ts init:edit"
  },
  "description": "Note: All init commands support --migrate flag for production setup",
  "devDependencies": {
    "@inquirer/prompts": "^8.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0",
    "boxen": "^8.0.0",
    "handlebars": "^4.7.8",
    "ofetch": "^1.4.0",
    "glob": "^11.0.0",
    "zod": "^3.22.0"
  }
}
```

**.gitignore** - Add backup config only:
```gitignore
# Backup config (created during init:new)
init-config.backup.json
```

**NOTE:** `init-config.json` is **COMMITTED** to git (shared across all developers)
```

**docker-compose.yml** - Update to use `${PROJECT_NAME:-template}` pattern:
```yaml
services:
  postgres:
    container_name: ${PROJECT_NAME:-template}-postgres
    environment:
      POSTGRES_DB: ${PROJECT_NAME:-template}
      POSTGRES_USER: ${PROJECT_NAME:-template}
    # Test database also uses PROJECT_NAME
  redis:
    container_name: ${PROJECT_NAME:-template}-redis

# All DATABASE_URL references should use ${PROJECT_NAME}:
# postgresql://user:pass@localhost:5432/${PROJECT_NAME}
# postgresql://user:pass@localhost:5432/${PROJECT_NAME}_test
```

**Note:** If docker-compose.yml doesn't already have this pattern, it should be updated as part of this implementation.

**scripts/setup/init.sh** - DELETE (replaced by TypeScript implementation)

**scripts/setup/check-prereqs.sh** - ENHANCE:
- Add Doppler CLI check (required, not optional)
- Add version checks for Bun (1.0+), Docker (20.10+)
- Add git clean check

### Files Referenced (Reuse As-Is)

- `scripts/setup/sync-env.sh` - Copy .env.example → .env.local
- `scripts/setup/dopplerSetup.ts` - Create Doppler project + environments
- `scripts/setup/wait-postgres.sh` - Wait for PostgreSQL ready
- `scripts/setup/wait-redis.sh` - Wait for Redis ready

## Implementation Steps

**Single Implementation (All Components):**

1. **Setup Dependencies**
   - Add to package.json: `@inquirer/prompts`, `ora`, `chalk`, `boxen`, `handlebars`, `ofetch`, `glob`, `zod`
   - Run `bun install`
   - Update `.gitignore` to exclude `init-config.backup.json` ONLY
   - **DO NOT** gitignore `init-config.json` - it's committed and shared

2. **Create Directory Structure**
   - Create `scripts/init/` with steps/, utils/, templates/ subdirectories

3. **Update docker-compose.yml** (if needed)
   - Ensure all container names use `${PROJECT_NAME:-template}` pattern
   - Ensure POSTGRES_DB, POSTGRES_USER use env var
   - Verify test database uses `${PROJECT_NAME}_test`

4. **Implement Utilities** (`utils/`)
   - `config.ts` - init-config.json management with Zod validation
     - Define ConfigSchema with Zod
     - loadConfig() validates on read
     - Some fields required, some have defaults
     - Type-safe with z.infer<typeof ConfigSchema>
   - `ui.ts` - ora, chalk, boxen wrappers
   - `secrets.ts` - Crypto secret generation (Ed25519, BETTER_AUTH_SECRET)
   - `rename.ts` - Surgical renaming logic (detect current name, re-runnable)
   - `validation.ts` - Health checks (DB, Redis, Sentry connectivity)
   - `render.ts` - Render API client (ofetch wrapper)
   - `sentry.ts` - Sentry API client (ofetch wrapper)
   - `doppler.ts` - Doppler API client
   - `prompt.ts` - @inquirer/prompts wrappers (simple TUI helpers)

5. **Implement All Steps** (01-15)
   - 01: Prerequisites (Doppler CLI required, Bun, Docker, Git)
   - 02: Configuration (simple TUI with sectioned prompts)
   - 03: Rename (surgical: packages + imports only, re-runnable)
   - 04: Doppler setup (FIRST - create project + environments)
   - 05: Secrets generation (generate + push to Doppler immediately)
   - 06: Render provisioning (database, Redis, API, worker)
   - 07: Sentry setup (4 projects + DSNs)
   - 08: Email provider (optional)
   - 09: OAuth (optional)
   - 10: DNS configuration (instructions + verification)
   - 11: PROJECT_NAME setup (env files + Doppler)
   - 12: Environment files (sync-env.sh)
   - 13: Database setup (Docker + Prisma + offer push/migrate + seed)
   - 14: Validation (DB, Redis, smoke tests)
   - 15: Finalize (docs + git commit)

6. **Wire Main Orchestrator** (`index.ts`)
   - Command handling (init, init:new, init:edit)
   - Config file management
   - Progress tracking with resume capability
   - Step sequencing
   - Error handling with save-and-resume

7. **Create Templates**
   - `INIT_COMPLETE.md.hbs` - Credentials summary with all service info

8. **Create Launch Script**
   - Create `scripts/launch/index.ts`
   - Implements mode switching (development → production)
   - Updates configuration flags (CICD, database, git, monitoring, features)
   - Generates CI/CD workflows, updates branch protections
   - Optionally deploys to production

9. **Update Application to Use Config Flags**
   - Modify `apps/api/src/index.ts` to load config on startup
   - Add middleware that checks flags:
     - Rate limiting (if `flags.features.rateLimiting`)
     - Caching (if `flags.features.caching`)
     - Database strategy (check `flags.database.strategy`)
   - Update logger initialization to use `flags.monitoring.logLevel`
   - Update Sentry init to use `flags.monitoring.sentryEnvironment`
   - Create utility function `getConfig()` for accessing flags

10. **Update Package Scripts**
    - Add `"init": "bun ./scripts/init/index.ts init"`
    - Add `"init:new": "bun ./scripts/init/index.ts init:new"`
    - Add `"init:edit": "bun ./scripts/init/index.ts init:edit"`
    - Add `"launch": "bun ./scripts/launch/index.ts"`
    - Add both `db:push` and `db:migrate` to package.json (if not already present)

11. **Delete Old Implementation**
    - Remove `scripts/setup/init.sh` (replaced by TypeScript)

12. **Testing**
    - Unit tests for utilities (rename, secrets, config management)
    - Integration test on temp fork
    - Manual verification:
      - Test init (fresh)
      - Test resume (ctrl+c mid-run, then re-run init)
      - Test init:new (with existing config)
      - Test init:edit (edit then re-run)
      - Test re-renaming (template → name1 → name2)
      - Test --migrate flag (init and init:new)
      - Verify no API keys in init-config.json
      - **Test launch script:**
        - After init completes, run `bun run launch`
        - Verify migrations created (not just push)
        - Verify deployment triggered to Render
        - Verify config marked as `launched: true`
        - Try running launch again (should prompt for confirmation)
        - Verify production migrations ran successfully

13. **Documentation**
    - Update `docs/claude/SCRIPTS.md` with new commands (init, init:new, init:edit, launch)
    - Update `docs/claude/SETUP.md` to reference `bun run init` for new forks
    - Document configuration flags in `docs/claude/CONFIGURATION.md` (new file)
    - Document mode switching (development vs production) with examples
    - Update ticket INFRA-001 to mark as complete
    - Create ticket INFRA-009 for space type scaffolding (future work)

## Verification

**Automated Tests:**
```bash
# Unit tests for each step
bun test scripts/init/steps/*.test.ts

# Integration test (uses temp directory)
bun test scripts/init/integration.test.ts
```

**Manual Test (on fresh fork):**
1. Fork template to new directory
2. Prepare API keys:
   - Render API key
   - Sentry auth token
   - Email provider API key (optional)
3. Run `bun run init`
4. Answer prompts:
   - Project name: testproject
   - Organization: Test Org
   - Domain: testproject.com
   - Environments: dev, staging, prod
   - Render API key: [paste]
   - Sentry auth token: [paste]
   - Email provider: Resend (or skip)
   - OAuth: No
5. Wait for provisioning (~10-15 minutes)
6. Verify:
   - Rename completed (check package.json, imports)
   - Doppler project created with secrets
   - Render services provisioned (database, Redis, API, worker)
   - Sentry projects created (4 DSNs)
   - Email provider configured (if selected)
   - INIT_COMPLETE.md has all credentials
7. Run `bun run local`
8. Open http://localhost:3000
9. Verify login works
10. Trigger test error, check Sentry
11. Send test email (if configured)

**Resume Test:**
1. Run `bun run init`
2. Ctrl+C during database setup
3. Run `bun run init` again
4. Verify it resumes from database step

**Restart Test:**
1. Run `bun run init` (complete)
2. Run `bun run init:new` (should prompt for confirmation)
3. Confirm and verify fresh start with new config

**Re-rename Test:**
1. Run `bun run init` with project name "testproject1"
2. Complete initialization
3. Run `bun run init:new` with project name "testproject2"
4. Verify:
   - Package names changed from @testproject1/* to @testproject2/*
   - Imports updated in all TS/TSX files
   - init-config.json has new project name
   - PROJECT_NAME env var updated everywhere
   - docker-compose.yml still uses ${PROJECT_NAME:-template} (unchanged)

## Changes from Original Plan

This plan evolved based on user feedback. Key architectural changes:

### 1. Command Structure
- **Original:** Single `init` command with `init:restart` to clear progress
- **Updated:** Three commands (`init`, `init:new`, `init:edit`) with smart resume detection

### 2. Rename Strategy
- **Original:** Replace all 667+ occurrences of "template" string across codebase
- **Updated:** **Surgical approach** - only replace @template in package names and imports
  - Everything else (containers, databases, service names) uses PROJECT_NAME env var
  - Benefits: Re-runnable, cleaner separation, easier maintenance
  - Supports template → name1 → name2 by detecting current name

### 3. TUI Approach
- **Original:** Sequential prompts
- **Updated:** Navigation menu with progress indicators
  - Main menu shows all steps with visual status:
    - ○ required (red) - not started
    - - optional (gray) - not started
    - ◐ partial (yellow) - in progress
    - ✓ done (green) - complete
  - Non-linear navigation (jump to any step, any order)
  - Each step offers: Back to menu | Save & back | Save & next
  - Can exit anytime (warns if incomplete, resume with `bun run init`)
  - Still uses simple @inquirer/prompts (not complex framework)

### 4. Config File
- **Original:** `.init-progress.json` for progress tracking only
- **Updated:** `init-config.json` for BOTH configuration and progress
  - Comprehensive structure includes all service credentials
  - Supports editing via `init:edit` command

### 5. Doppler Timing
- **Original:** Secrets (#4) before Doppler (#5)
- **Updated:** Doppler (#4) before Secrets (#5)
  - Rationale: Push secrets to Doppler immediately after generation

### 6. DATABASE_URL & Container Names
- **Original:** Hardcode replacements in .env files and docker-compose.yml
- **Updated:** Use PROJECT_NAME env var with fallback pattern
  - docker-compose.yml: `${PROJECT_NAME:-template}`
  - DATABASE_URL: `postgresql://.../${PROJECT_NAME}`
  - No hardcoded replacements needed

### 7. Database Migration
- **Original:** Only offer db:push
- **Updated:** Use `--migrate` flag to choose strategy
  - Default: db:push (fast for dev)
  - With flag: db:migrate (production-ready, version controlled)
  - No interruption to flow with prompts

### 8. Security - API Key Storage
- **Original:** Store API keys in init-config.json (marked as [REDACTED])
- **Updated:** NEVER store API keys in config file
  - Only store boolean flags: `keysConfigured`, `dopplerConfigured`, `localConfigured`
  - Store non-sensitive metadata: service IDs, URLs, organization names
  - Store public values: DSNs (already public), connection strings (credentials in Doppler)
  - Benefits: No secrets at rest in config, safe to commit to version control (with .gitignore)

### 9. Launch Script (Mode-Based Configuration)
- **Original:** Not planned
- **Updated:** Added `bun run launch` as configuration mode switcher
  - **Not just deployment** - changes configuration flags that control behavior
  - Switches `mode`: development → production
  - Updates flags for: CICD, database strategy, git policies, monitoring, features
  - Application code reads these flags to change runtime behavior
  - Generates CI/CD workflows, updates branch protections
  - Optionally deploys to production
  - Supports reverting to development mode
  - Flow: init (setup) → develop (mode: dev) → launch (mode: prod)

## Future Work & TODOs

### 1. Space Type Customization (Post-Init Feature)

**Concept:** Allow users to customize the Space model based on their domain during or after init.

**Potential Space Types:**
- Game spaces (genre, platform, releaseDate)
- Store spaces (inventory, products, transactions)
- Project spaces (tasks, milestones, sprints)
- Generic (current default)

**Implementation Options:**

**Option A: Scaffold Command** (Recommended)
```bash
bun run init                    # Infrastructure setup
bun run scaffold:space game     # Add game-specific schema/routes/components
bun run scaffold:space store    # Add store-specific schema/routes/components
```

**Option B: Init Configuration**
```typescript
// During init step 02-configure
const spaceTypes = await checkbox({
  message: 'What types of spaces will your app use?',
  choices: ['generic', 'game', 'store', 'project', 'custom']
});
```

**What it would generate:**
1. Prisma schema extensions (using false polymorphism pattern)
   ```prisma
   model SpaceGame {
     id String @id
     spaceId String @unique
     space Space @relation(...)
     genre String
     platform String
     releaseDate DateTime
   }
   ```
2. API routes (`/games`, `/stores`, `/projects`)
3. Frontend components specific to space type
4. Permissions/roles per space type

**Recommendation:** Implement as **separate scaffold command**, not part of init:
- Init is already complex (cloud provisioning)
- This is domain customization, not infrastructure
- Easier to test/maintain as separate feature
- Can be run multiple times (multi-type support)

**Ticket:** Create `INFRA-009-space-type-scaffolding.md`

### 2. Launch Script Enhancements

**Current Plan:** Production deployment script (creates migrations, deploys to Render)

**Future Enhancements:**
- Blue-green deployment support
- Automatic rollback on failed health checks
- Slack/email notification on successful launch
- Performance baseline testing post-launch
- Automatic Sentry release creation with git commit SHA
- Environment-specific launches (`bun run launch:staging`, `bun run launch:prod`)
- Pre-launch checklist validation (DNS, SSL, secrets, etc.)

### 3. Init Configuration Validation

**Add validation step:**
- Verify Render services are actually running
- Test Sentry DSNs with test event
- Verify email provider with test send
- Check DNS propagation automatically

### 4. Rollback Capability

**Add `bun run init:rollback`:**
- Restore from `init-config.backup.json`
- Optionally delete cloud resources (Render, Sentry projects)
- Reset to pre-init state

### 5. Multi-Region Support

**Allow provisioning in multiple regions:**
- Render services in multiple regions
- Separate Doppler configs per region
- Region-specific environment files

### 6. CI/CD Integration

**Auto-generate GitHub Actions / GitLab CI:**
- Based on init configuration
- Deploy to Render on push
- Run tests, migrations
- Sentry release tracking

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Scope** | Full provisioning (local + cloud) | User choice: complete setup in one run |
| **Doppler** | **REQUIRED** (not optional) | User choice: standardize on Doppler for secrets |
| **Doppler Timing** | BEFORE secret generation | Secrets pushed immediately after generation |
| **Implementation** | All at once (not incremental) | User choice: single PR with full feature |
| **Language** | TypeScript | Better than Bash for complex logic, error handling, type safety |
| **TUI** | Simple (@inquirer/prompts) | User choice: simple is better than complex (not ink framework) |
| **Config File** | init-config.json (comprehensive) | Both configuration AND progress tracking in one file |
| **Commands** | Three (init, init:new, init:edit) | Smart resume, force new, edit config via TUI |
| **Resume** | Yes, via init-config.json | Init takes 10-15min, network can fail mid-process |
| **Rename Strategy** | **Surgical** (packages + imports only) | User choice: only @template in code, rest uses PROJECT_NAME env var |
| **Re-runnable Rename** | Support template → name1 → name2 | Detect current name from config/package.json, replace with new name |
| **PROJECT_NAME** | Env var for runtime config | Container names, DB names, service names all read from env var |
| **Secret Generation** | Node crypto module | Cross-platform, no openssl dependency |
| **Cloud APIs** | ofetch for Render/Sentry | Type-safe HTTP client with better DX than fetch |
| **DB Setup** | Offer both push AND migrate | User choice during init (migrate for prod, push for dev) |
| **Validation** | DB/Redis/Sentry connectivity | Verify all services working before completion |

## Success Criteria

**Setup Speed:**
- ✅ Fresh fork → production-ready in ~10-15 minutes
- ✅ Can resume after interruption (network failure, etc.) via init-config.json
- ✅ Can re-run to change project name (template → name1 → name2)

**Renaming:**
- ✅ Package names renamed: @template/* → @projectname/* (10 package.json files)
- ✅ TypeScript imports updated: @template/* → @projectname/* (~660 occurrences)
- ✅ **Everything else uses PROJECT_NAME env var** (not hardcoded replacements)
- ✅ docker-compose.yml uses ${PROJECT_NAME:-template} pattern
- ✅ DATABASE_URL uses ${PROJECT_NAME} in env files

**Secrets & Configuration:**
- ✅ Doppler project created BEFORE secret generation
- ✅ All secrets pushed to Doppler immediately after generation
- ✅ PROJECT_NAME set in all .env.local files and Doppler environments
- ✅ init-config.json contains both configuration and progress

**Cloud Services:**
- ✅ Render services provisioned and running:
  - PostgreSQL database (starter tier)
  - Redis instance
  - API web service
  - Background worker
- ✅ Sentry projects created for all apps (API, web, admin, superadmin) with DSNs
- ✅ Email provider configured (if selected)
- ✅ OAuth providers configured (if selected)
- ✅ DNS configuration documented with instructions

**Local Environment:**
- ✅ Local database seeded with test data (bun run db:seed --prime)
- ✅ Docker containers running with correct PROJECT_NAME
- ✅ Dev environment starts without errors (`bun run local`)
- ✅ All validations pass (DB, Redis, smoke tests)

**Documentation & UX:**
- ✅ INIT_COMPLETE.md generated with all credentials and next steps
- ✅ Navigation TUI with progress indicators:
  - Main menu shows all steps with status (required/optional/partial/done)
  - Shows last 4 digits of API keys for verification (•••a7f3)
  - Non-linear navigation (can jump to any step)
  - Each step offers: Back | Save & back | Save & next
  - Can exit anytime (warns if incomplete, resume later)
- ✅ Clear progress indicators during long-running operations
- ✅ Three commands work correctly (init, init:new, init:edit)
- ✅ Git commit created (optional, user choice)

**Security:**
- ✅ API keys and secrets NEVER stored in init-config.json
- ✅ Config only contains flags (keysConfigured, dopplerConfigured, localConfigured)
- ✅ All secrets stored in Doppler and .env.local only
- ✅ init:edit re-prompts for API keys (never pre-filled)

**Launch Script (Production Mode Switch):**
- ✅ `bun run launch` switches from development → production mode
- ✅ Updates configuration flags (database, CICD, git, monitoring, features)
- ✅ Generates CI/CD workflow files based on flags
- ✅ Updates git branch protection rules
- ✅ Optionally deploys to Render
- ✅ Creates migrations if strategy changed to migrate
- ✅ Runs production migrations
- ✅ Verifies production health
- ✅ Supports reverting to development mode
- ✅ Application code reads flags to change behavior

**Migration Strategy:**
- ✅ Default: db:push (fast for dev)
- ✅ `--migrate` flag: db:migrate (production-ready)
- ✅ Works with all init commands (init, init:new)
