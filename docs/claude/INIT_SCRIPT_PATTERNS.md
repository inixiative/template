# Init Script - Architecture & Patterns

**Location:** `init/`

Automated infrastructure provisioning via Terminal UI (Ink). Full implementation guide for INFRA-001 ticket.

**Current implementation notes:**
- Source of truth now lives under `init/**` plus root-level `project.config.ts`
- Persist only atomic progress flags: one flag = one idempotent, externally verifiable provider fact
- Views may group atomic flags into friendlier UI labels like `Bootstrap ready (4/6)`
- Task coverage uses Bun-native tests plus fixture-backed VCR helpers under `init/tests/`
- Launch is part of the init flow: preflight checks gate flipping `launched = true`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ app.tsx (ConfigProvider wraps everything)          │
│  ├─ Prerequisites (CLI checks)                      │
│  ├─ MainMenu (task selection)                       │
│  └─ Task Views (Infisical, PlanetScale, etc.)       │
│      └─ Call tasks/ functions with syncConfig       │
└─────────────────────────────────────────────────────┘

State Flow:
  1. Task modifies config file (markComplete)
  2. Task calls syncConfig()
  3. Context re-reads config (cache-busted)
  4. All views auto-update (derived state)
```

---

## Core Patterns

### 1. Root-Level Config State (Context Provider)

**Pattern:** Single source of truth for project config, shared across all views via Context.

**Location:** `init/utils/configState.tsx`

```typescript
// Provider wraps the entire app
<ConfigProvider>
  <App />
</ConfigProvider>

// Views consume config
const { config, syncConfig } = useConfig();
```

**Why:**
- ✅ No prop drilling
- ✅ Single read of config file
- ✅ All views auto-update when config changes
- ✅ No polling needed

**Implementation:**
```typescript
type ConfigContextType = {
  config: ProjectConfig | null;
  syncConfig: () => Promise<void>;
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ProjectConfig | null>(null);

  const syncConfig = useCallback(async () => {
    const cfg = await getProjectConfig();
    setConfig(cfg);
  }, []);

  // Initial load
  useEffect(() => {
    syncConfig();
  }, [syncConfig]);

  return (
    <ConfigContext.Provider value={{ config, syncConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
```

### 2. Manual Sync Triggers (No Polling)

**Pattern:** Tasks call `syncConfig()` after each step completes. No automatic polling.

**Why:**
- ✅ More efficient (only sync when needed)
- ✅ Instant updates (no 500ms delay)
- ✅ Simpler code (no intervals to manage)

**Implementation:**
```typescript
// Task function receives syncConfig callback
export const setupInfisical = async (
  orgId: string,
  onStepComplete?: () => Promise<void>
): Promise<...> => {
  // Step 1
  markComplete('infisical', 'selectOrg');
  await onStepComplete?.(); // Trigger config re-read

  // Step 2
  markComplete('infisical', 'createProject');
  await onStepComplete?.(); // Trigger config re-read

  // ... etc
};

// View passes syncConfig to task
const runSetup = async (orgId: string) => {
  setRunning(true);
  await setupInfisical(orgId, syncConfig); // Pass callback
  await syncConfig(); // Final refresh
  setRunning(false);
};
```

### 3. Cache Busting on Imports

**Pattern:** Add timestamp query param to dynamic imports to bypass Node/Bun module cache.

**Location:** `init/utils/getProjectConfig.ts`

**Why:**
- Config file is `.ts`, loaded via `import()`
- Dynamic imports are cached by Node/Bun
- Without cache busting, repeated reads return stale data

**Implementation:**
```typescript
export const getProjectConfig = async (): Promise<ProjectConfig> => {
  const configPath = join(process.cwd(), 'project.config.ts');

  // Bust import cache with timestamp to get fresh config
  const module = await import(configPath + '?t=' + Date.now());
  return module.projectConfig;
};
```

### 4. Derived State with useMemo

**Pattern:** Derive view state from config immediately (no useState delay).

**Why:**
- ✅ No flash/flicker on mount
- ✅ Always in sync with config
- ✅ No need to manually update

**Implementation:**
```typescript
// ❌ Bad: useState causes delay/flash
const [setupState, setSetupState] = useState<SetupState>('new');
useEffect(() => {
  if (!config) return;
  setSetupState(detectSetupState(config)); // Delay = flash
}, [config]);

// ✅ Good: useMemo derives instantly
const setupState = useMemo(
  () => config ? detectSetupState(config) : 'new',
  [config]
);
```

### 5. Composable Prompts (ALWAYS Use This!)

**⚠️ CRITICAL:** Never hardcode prompt text like "Press Enter..." or "Use ↑/↓...". Always use the `prompt()` helper.

**Pattern:** Define action commands once, compose them in consistent order.

**Location:** `init/utils/prompts.ts`

**Why:**
- ✅ Consistent ordering across all views
- ✅ DRY - no repeated prompt strings
- ✅ Easy to add new commands

**Implementation:**
```typescript
type Command = 'navigate' | 'select' | 'enter' | 'restart' | 'cancel' | 'exit';

// Define text for each command
const COMMAND_TEXT: Record<Command, string> = {
  navigate: 'Use ↑/↓ to navigate',
  select: 'Enter to select',
  enter: 'Enter to continue',
  restart: 'R to restart',
  cancel: 'Esc to cancel',
  exit: 'Ctrl+C to exit',
};

// Define order (earlier = appears first)
const COMMAND_ORDER: Command[] = ['navigate', 'select', 'enter', 'restart', 'cancel', 'exit'];

// Compose prompts
export function prompt(commands: Command[]): string {
  const sorted = commands.sort((a, b) =>
    COMMAND_ORDER.indexOf(a) - COMMAND_ORDER.indexOf(b)
  );
  const parts = sorted.map(cmd => COMMAND_TEXT[cmd]);
  const text = parts.join(', ');
  return text.startsWith('Use') ? text : `Press ${text}`;
}

// Usage in views
<Text dimColor>{prompt(['enter', 'cancel'])}</Text>
// => "Press Enter to continue, Esc to cancel"

<Text dimColor>{prompt(['navigate', 'select'])}</Text>
// => "Use ↑/↓ to navigate, Enter to select"
```

### 6. Clean Status Lists

**Pattern:** Show ALL steps upfront with status indicators, not streaming logs.

**Why:**
- ✅ User sees full picture before starting
- ✅ Live updates as each step completes
- ✅ Resumable - shows where you left off
- ✅ Clean UI - no console log noise

**Implementation:**
```typescript
const bootstrapCount = [
  progress.selectTeam,
  progress.storeTeamIdSecret,
  progress.storeTeamNameSecret,
  progress.promptedForGithub,
  progress.storeVercelToken,
  progress.createInfisicalConnection,
].filter(Boolean).length;

const progressItems = [
  { label: `Bootstrap ready (${bootstrapCount}/6)`, completed: bootstrapCount === 6 },
  { label: 'Web project created', completed: progress.createWebProject },
  { label: 'Web production sync configured', completed: progress.createWebInfisicalSyncProd },
  // ... etc
];

// Determine current step
const currentStepIndex = running ? progressItems.findIndex(item => !item.completed) : -1;

// Render all steps
{progressItems.map((item, i) => {
  const isCompleted = item.completed;
  const isInProgress = running && i === currentStepIndex;
  const isPending = !isCompleted && !isInProgress;

  return (
    <Box key={i}>
      {isCompleted && <Text color="green">✓ {item.label}</Text>}
      {isInProgress && <Text color="cyan"><Spinner type="dots" /> {item.label}</Text>}
      {isPending && <Text dimColor>− {item.label}</Text>}
    </Box>
  );
})}
```

**Output:**
```
✓ Bootstrap ready (6/6)
✓ Web project created
⠹ Web production sync configured
− Admin project created
− Superadmin project created
```

### 7. Suppress Console Logs in Tasks

**Pattern:** No `console.log` in task functions. All output via TUI views.

**Why:**
- Console writes to stdout
- Ink also writes to stdout
- They conflict and cause rendering issues
- TUI shows progress via status list (see pattern #6)

**Implementation:**
```typescript
// In task files (infisicalSetup.ts, etc.)
// Suppressed for TUI: console.log('Step completed');
markComplete('infisical', 'selectOrg');
await onStepComplete?.(); // View updates via config sync
```

### 8. Always Fetch from Source, Never Trust Props

**Pattern:** When resuming steps, always fetch secrets/config from their source (Infisical/config file), never rely on variables passed between steps.

**Why:**
- ✅ Handles resume scenarios (step already complete, but variable is undefined)
- ✅ Prevents "already exists" errors when recreating resources
- ✅ Single source of truth (Infisical for secrets, config file for metadata)
- ✅ More reliable than passing props through the execution chain

**Implementation:**
```typescript
// ❌ Bad: Rely on password object from previous step
if (!(await isProgressComplete('planetscale', 'initProdMigrationTable'))) {
  const prodConnectionString = productionPassword.connection_strings.general; // undefined if resuming!
  await initPrismaMigrationTable(prodConnectionString);
}

// ✅ Good: Fetch from Infisical (where step 8 stored it)
if (!(await isProgressComplete('planetscale', 'initProdMigrationTable'))) {
  const prodConnectionString = getSecret('DATABASE_URL', {
    projectId: infisicalProjectId,
    environment: 'prod',
    path: '/api',
  });
  await initPrismaMigrationTable(prodConnectionString);
}

// ✅ Good: Re-read from config (don't trust local variables)
if (!(await isProgressComplete('planetscale', 'configureDB'))) {
  const latestConfig = await getProjectConfig();
  const orgName = latestConfig.planetscale.organization;
  const dbName = latestConfig.planetscale.database;
  await updateDatabaseSettings(orgName, dbName, { ... });
}
```

**Rule of thumb:**
- Secrets → Always fetch from Infisical with `getSecret()`
- Config metadata → Always re-read from config with `getProjectConfig()`
- Never pass connection strings, passwords, or API keys between steps

### 9. Retry Logic for Async Initialization

**Pattern:** Wrap operations that depend on async resource provisioning in retry logic with exponential backoff and timeout.

**Why:**
- ✅ Handles async cloud provisioning (databases take 30-60s to initialize)
- ✅ Better UX than manual retries or cryptic "not ready" errors
- ✅ Configurable timeouts prevent infinite loops
- ✅ Specific retry conditions avoid retrying non-retryable errors

**When to use:**
- Database/cluster provisioning (PlanetScale, Render, AWS RDS)
- Branch creation after database creation
- Role/password creation on new branches
- API calls that depend on resource state transitions

**Implementation:**
```typescript
// utils/retry.ts
export const retryWithTimeout = async <T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    delayMs: number;
    retryCondition: (error: Error) => boolean;
    timeoutMessage: string;
  }
): Promise<T> => {
  const { maxRetries, delayMs, retryCondition, timeoutMessage } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (!retryCondition(error)) throw error;

      if (attempt >= maxRetries) {
        throw new Error(`${timeoutMessage}: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unreachable'); // TypeScript exhaustiveness
};
```

**Usage Example:**
```typescript
// Rename branch with 5-minute timeout (100 retries × 3s = 300s)
await retryWithTimeout(
  () => renameBranch(organization, databaseName, 'main', 'prod'),
  {
    maxRetries: 100,
    delayMs: 3000,
    retryCondition: (error) => {
      const msg = error.message.toLowerCase();
      return msg.includes('still initializing') ||
             msg.includes('not ready') ||
             msg.includes('cluster is not ready');
    },
    timeoutMessage: 'Branch rename timed out after 5 minutes - cluster not fully initialized'
  }
);
```

**Common retry conditions:**
- PlanetScale: `'still initializing'`, `'not ready'`, `'cluster is not ready'`
- Render: `'provisioning'`, `'deploying'`, `'starting'`
- General: `'temporarily unavailable'`, `'503'`, `'429'` (rate limit)

**Best practices:**
- Use 3-5 second delays (balance between responsiveness and API load)
- Set reasonable timeouts (5 minutes for databases, 1 minute for branches)
- Make retry conditions specific (don't retry auth errors, validation errors, etc.)
- Include timeout message with context for debugging

**What NOT to retry:**
- Authentication errors (401, 403)
- Validation errors (400, 422)
- Resource not found (404)
- Conflict errors (409) unless explicitly handling race conditions

### 10. Async Exec for Smooth Animations

**⚠️ CRITICAL:** Always use async `exec` with `promisify`, never `execSync`. Synchronous calls block the event loop and freeze spinner animations.

**Pattern:** Convert all CLI calls to async using promisify wrapper.

**Why:**
- ✅ Spinner animations continue during CLI calls
- ✅ Non-blocking - UI remains responsive
- ✅ Better UX - no freezing or lag
- ❌ execSync blocks Node event loop and pauses React rendering

**Implementation:**
```typescript
// At top of file - setup once
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// ❌ Bad: Blocks event loop, freezes spinners
export const listWorkspaces = async (): Promise<RailwayWorkspace[]> => {
  const { execSync } = await import('child_process');

  const output = execSync('railway whoami --json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  return JSON.parse(output).workspaces || [];
};

// ✅ Good: Async, animations continue smoothly
export const listWorkspaces = async (): Promise<RailwayWorkspace[]> => {
  const { stdout } = await execAsync('railway whoami --json', {
    encoding: 'utf-8'
  });

  return JSON.parse(stdout.trim()).workspaces || [];
};
```

**Key differences:**
- `execSync` returns `string` directly, `execAsync` returns `{ stdout, stderr }`
- Remove `stdio: ['pipe', 'pipe', 'pipe']` - not needed with promisify
- Use `stdout.trim()` instead of `.trim()` on the result
- Always `await` the async call

**Convert ALL CLI calls:**
```typescript
// PlanetScale
await execAsync('pscale org list --format json', { encoding: 'utf-8' });
await execAsync('pscale region list --org ${org} --format json', { encoding: 'utf-8' });
await execAsync('pscale branch create ${db} ${branch} --org ${org} --format json', { encoding: 'utf-8' });

// Railway
await execAsync('railway whoami --json', { encoding: 'utf-8' });
await execAsync('railway environment link ${env}', { encoding: 'utf-8', cwd: process.cwd() });
await execAsync('railway add --service "${name}" --json', { encoding: 'utf-8', cwd: process.cwd() });

// Infisical
await execAsync('infisical org list --format json', { encoding: 'utf-8' });
```

**Rule:** If you see `execSync` anywhere in `init/api/`, it's a bug. Convert to async immediately.

### 11. Railway CLI vs GraphQL API

**Pattern:** Use Railway CLI commands for simple queries, GraphQL API for mutations.

**Why:**
- ✅ CLI is more reliable for auth (uses local session)
- ✅ No need to manage API tokens for read-only operations
- ✅ Consistent with how other services work (Infisical, PlanetScale)

**When to use each:**
- **CLI**: Workspace/org listing, read-only queries, session checks
- **GraphQL API**: Creating resources, updating config, deployments

### 12. Token Input Flow with Proper State Management

**Pattern:** When prompting for tokens/credentials, manage loading states carefully to prevent UI jumps or blank screens.

**Why:**
- ✅ Smooth transitions between input → storage → next step
- ✅ Immediate visual feedback during async operations
- ✅ No unexpected view changes or blank screens
- ❌ Common bug: setting running state at wrong time causes blank screen

**Implementation:**
```typescript
const handleTokenSubmit = async () => {
  if (!config || !workspaceToken.trim()) return;

  setStoringToken(true);  // Show "Storing..." spinner

  try {
    // Store token in Infisical
    await setSecret(projectId, 'root', 'RAILWAY_TOKEN', workspaceToken.trim());

    setStoringToken(false);  // Hide storing spinner

    // Determine next step
    const existingWorkspace = config.railway?.workspaceId;

    if (existingWorkspace) {
      // Have workspace - go directly to setup
      setRunning(true);
      setViewState('status');
      await runSetup(existingWorkspace);
    } else if (workspaces.length === 1) {
      // Only one workspace - auto-select it
      setRunning(true);
      setViewState('status');
      await runSetup(workspaces[0].id);
    } else {
      // Multiple workspaces - need to select
      setRunning(false);  // ⚠️ CRITICAL: Must set false for selector
      setViewState('workspace-select');
    }
  } catch (error) {
    setStoringToken(false);
    setRunning(false);
    throw error;
  }
};
```

**Key rules:**
1. **Set loading states BEFORE changing viewState**
   - ✅ `setStoringToken(true)` → show spinner in current view
   - ✅ `setRunning(true)` → show spinner in status view
   - ❌ Never switch views without setting appropriate loading state first

2. **Clear loading states BEFORE next transition**
   - ✅ `setStoringToken(false)` after storage completes
   - ✅ Then set next state (`setRunning` or `setViewState`)
   - ❌ Don't leave multiple loading states active simultaneously

3. **Always set running=false before showing selectors**
   - ✅ `setRunning(false)` + `setViewState('workspace-select')`
   - ❌ Leaving `running=true` will show loading spinner in selector

**Visual feedback in token input:**
```typescript
{storingToken ? (
  <Box marginTop={1}>
    <Text color="cyan">
      <Spinner type="dots" /> Storing token and continuing setup...
    </Text>
  </Box>
) : (
  <>
    <Box marginTop={1}>
      <Text>Token: </Text>
      <TextInput value={token} onChange={setToken} onSubmit={handleSubmit} mask="*" />
    </Box>
    <Box marginTop={1}>
      <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
    </Box>
  </>
)}
```

### 13. Atomic Progress Flags + Idempotent API Calls

**Pattern:** Persist one progress flag per externally verifiable action, and make the underlying setup call idempotent whenever the provider API allows it.

**Why:**
- ✅ Setup can be re-run without errors
- ✅ Handles interrupted setup gracefully
- ✅ Resume from any point without manual cleanup
- ✅ Better UX - no "already exists" errors
- ✅ Prevents half-complete bundled steps from breaking resume

**Rules:**
- ✅ One progress flag = one provider fact (`storeProdRedisUrl`, `createInfisicalConnection`, `initProdMigrationTable`)
- ✅ Group multiple flags only in the view layer, never in persisted config
- ✅ If a step can partially succeed, split it before marking progress
- ❌ Don't store umbrella flags like "create passwords" or "configure everything" when they hide multiple remote writes

**Implementation:**
```typescript
// ❌ Bad: Fails if resource already exists
export const createRailwayConnection = async (
  infisicalProjectId: string,
  railwayApiToken: string,
  connectionName: string
): Promise<string> => {
  const response = await fetch('https://app.infisical.com/api/v1/app-connections/railway', {
    method: 'POST',
    body: JSON.stringify({ name: connectionName, ... })
  });

  if (!response.ok) {
    throw new Error(`Failed to create connection: ${await response.text()}`);
  }

  return response.json().appConnection.id;
};

// ✅ Good: Idempotent - returns existing if already created
export const createRailwayConnection = async (
  infisicalProjectId: string,
  railwayApiToken: string,
  connectionName: string
): Promise<string> => {
  const response = await fetch('https://app.infisical.com/api/v1/app-connections/railway', {
    method: 'POST',
    body: JSON.stringify({ name: connectionName, ... })
  });

  if (!response.ok) {
    const errorText = await response.text();

    // If connection already exists, find and return its ID
    if (errorText.includes('already exists')) {
      const connections = await listRailwayConnections(infisicalProjectId);
      const existing = connections.find(conn => conn.name === connectionName);
      if (existing) {
        return existing.id;  // Return existing instead of failing
      }
    }

    throw new Error(`Failed to create connection: ${errorText}`);
  }

  return response.json().appConnection.id;
};
```

**Pattern for sync creation:**
```typescript
export const createRailwaySync = async (
  projectId: string,
  syncName: string,
  ...config
): Promise<void> => {
  const response = await fetch('https://app.infisical.com/api/v1/secret-syncs/railway', {
    method: 'POST',
    body: JSON.stringify({ name: syncName, ...config })
  });

  if (!response.ok) {
    const errorText = await response.text();

    // If sync already exists, silently skip - this makes setup idempotent
    if (errorText.includes('already exists')) {
      return;  // Success - sync exists
    }

    throw new Error(`Failed to create sync: ${errorText}`);
  }
};
```

**When to make operations idempotent:**
- ✅ Resource creation (projects, services, connections, syncs)
- ✅ Configuration updates (can be reapplied safely)
- ✅ Secret storage (overwriting is fine)
- ❌ Destructive operations (deletes, renames) - use progress flags instead

**Alternative pattern - check before create:**
```typescript
// Option 2: Check existence before attempting creation
export const ensureRailwayConnection = async (...): Promise<string> => {
  // Try to find existing
  const connections = await listRailwayConnections(projectId);
  const existing = connections.find(conn => conn.name === connectionName);

  if (existing) {
    return existing.id;  // Already exists
  }

  // Create new
  const response = await fetch(...);
  return response.json().appConnection.id;
};
```

**Choose approach based on API:**
- **Catch error pattern**: When API doesn't provide list endpoint
- **Check-then-create pattern**: When list endpoint is available and efficient
- **Both**: Catch error + check list (safest, handles race conditions)

### 14. OrgSelector Always Requires onCancel

**Pattern:** OrgSelector component always requires `onCancel` prop (not optional).

**Why:**
- ✅ Consistent UX - all selection views are cancellable
- ✅ Prevents user getting stuck in selection screen
- ✅ Matches pattern with other input components

**Implementation:**
```typescript
// Component definition
type OrgSelectorProps = {
  organizations: Organization[];
  serviceName: string;
  onSelect: (orgId: string) => void;
  onCancel: () => void;  // Required, not optional!
};

// Usage in all views
<OrgSelector
  organizations={workspaces}
  serviceName="Railway"
  onSelect={handleWorkspaceSelect}
  onCancel={onCancel}  // Always provide
/>
```

**Don't make it optional:**
```typescript
// ❌ Bad
onCancel?: () => void;

// ✅ Good
onCancel: () => void;
```

### 15. Interactive User Prompts for Required Input

**Pattern:** When setup requires user-provided values (tokens, credentials, etc.), prompt interactively using TextInput instead of failing with error messages.

**Why:**
- ✅ Guides users through complete setup without external steps
- ✅ Prevents setup from failing partway through
- ✅ Collects and stores required values in one flow
- ✅ Better UX than error → manual action → retry

**When to use:**
- API tokens that can't be auto-generated
- Credentials that must be created manually in external services
- Configuration values that require user decision

**Implementation:**
```typescript
// 1. Add viewState for input screen
type ViewState = 'status' | 'workspace-select' | 'token-input' | 'running';

// 2. Add state for input value
const [workspaceToken, setWorkspaceToken] = useState('');

// 3. Check if required value exists before running setup
const runSetup = async (workspaceId: string) => {
  // Check if token exists in Infisical
  let hasToken = false;
  try {
    const token = getSecret('RAILWAY_WORKSPACE_TOKEN', {
      projectId: infisicalProjectId,
      environment: 'root',
    });
    hasToken = !!token;
  } catch (error) {
    hasToken = false;
  }

  // If missing, show input view instead of proceeding
  if (!hasToken) {
    setViewState('token-input');
    return;
  }

  // Token exists, proceed with setup
  setRunning(true);
  await setupTask(workspaceId, syncConfig);
};

// 4. Render input view with instructions
if (viewState === 'token-input') {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Railway Workspace Token Required</Text>

      <Box marginTop={1}>
        <Text>Create a workspace token at: <Text color="cyan">https://railway.com/account/tokens</Text></Text>
      </Box>

      <Box marginTop={1}>
        <Text>Paste the token below:</Text>
      </Box>

      <Box marginTop={1}>
        <Text>Token: </Text>
        <TextInput
          value={workspaceToken}
          onChange={setWorkspaceToken}
          onSubmit={handleTokenSubmit}
          mask="*"  // Hide sensitive input
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
      </Box>
    </Box>
  );
}

// 5. Handle submission - store value and continue
const handleTokenSubmit = async () => {
  if (!workspaceToken.trim()) return;

  // Store in Infisical
  setSecret(infisicalProjectId, 'root', 'RAILWAY_WORKSPACE_TOKEN', workspaceToken.trim());

  // Continue with setup
  await runSetup(workspaceId);
};

// 6. Handle escape to cancel
useInput((input, key) => {
  if (viewState === 'token-input' && key.escape) {
    onCancel();
  }
});
```

**Key points:**
- Check for required values BEFORE starting automated steps
- Show clear instructions including external URLs
- Use `mask="*"` for sensitive inputs (tokens, passwords)
- Store collected values in Infisical for future runs
- Allow Escape to cancel during input
- Task function assumes value exists (view ensures it does)

**Example flow:**
1. User starts Railway setup
2. View checks if RAILWAY_WORKSPACE_TOKEN exists
3. Not found → show token input screen with instructions
4. User creates token at railway.com/account/tokens
5. User pastes token and presses Enter
6. View stores token in Infisical
7. View continues with automated setup
8. Future runs skip input (token already exists)

### 16. State Management Standards

**Pattern:** Consistent naming and separation of concerns for state variables across all setup views.

**Why:**
- ✅ Predictable code - same patterns everywhere
- ✅ Clear separation between UI navigation and business logic
- ✅ Easier debugging and maintenance
- ✅ No confusion between execution state and view state

**Implementation:**

#### ViewState - UI Navigation Only

**Always use:**
- **Variable name**: `viewState` (never `state`)
- **Type name**: `ViewState`
- **Values**: UI screen names only

```typescript
type ViewState = 'status' | 'org-select' | 'token-input' | 'region-select';
const [viewState, setViewState] = useState<ViewState>('status');
```

**Rules:**
- ❌ Never include execution states like `'running'`, `'executing'`, `'loading'` in ViewState
- ❌ Never use generic name `state` instead of `viewState`
- ✅ Only include screen/modal names that represent what the user sees

#### SetupState - Business Logic State

**Always use:**
- **Variable name**: `setupState` (derived, never stored)
- **Type name**: `SetupState`
- **Values**: `'new' | 'stale' | 'incomplete' | 'complete'`
- **Derived via**: `useMemo` from config

```typescript
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

const setupState = useMemo(
  () => config ? detectSetupState(config) : 'new',
  [config]
);
```

**Rules:**
- ✅ Always derive from config using `useMemo` (never `useState`)
- ✅ Compute in `detectSetupState()` helper function
- ❌ Never store in state (always computed from config)

#### Boolean Flags - Execution State

**Naming conventions:**
- **`running`**: Main setup task is executing
- **`loading<Entity>`**: Specific entity is loading (e.g., `loadingOrgs`, `loadingWorkspaces`, `loadingRegions`)
- **`storing<Action>`**: Async storage operation in progress (e.g., `storingToken`)

```typescript
const [running, setRunning] = useState(false);           // Setup is running
const [loadingOrgs, setLoadingOrgs] = useState(true);    // Fetching organizations
const [loadingRegions, setLoadingRegions] = useState(false); // Fetching regions
```

**Rules:**
- ✅ Use `running` for main setup execution
- ✅ Use `loading<Entity>` pattern for data fetching
- ✅ Use `storing<Action>` for specific async operations
- ❌ Never duplicate execution state (e.g., don't have `running` boolean AND `'running'` ViewState)

#### Complete Example

```typescript
// ✅ Good - Follows all standards
type ViewState = 'status' | 'org-select' | 'region-select' | 'token-input';
type SetupState = 'new' | 'stale' | 'incomplete' | 'complete';

const [viewState, setViewState] = useState<ViewState>('status');
const [running, setRunning] = useState(false);
const [loadingOrgs, setLoadingOrgs] = useState(true);

const setupState = useMemo(
  () => config ? detectSetupState(config) : 'new',
  [config]
);
```

```typescript
// ❌ Bad - Multiple issues
type ViewState = 'loading' | 'prompt-name' | 'executing' | 'running' | 'complete'; // Execution states in ViewState
const [state, setState] = useState<ViewState>('loading'); // Generic name
const [running, setRunning] = useState(false); // Duplicates 'running' ViewState
```

#### Animation/Loading State Pattern

**Always set loading state BEFORE async operations:**

```typescript
// ✅ Good - Immediate visual feedback
const handleAction = async () => {
  setRunning(true);        // Show spinner immediately
  setViewState('status');  // Switch to status view
  await runSetup();        // Then run async work
};
```

```typescript
// ❌ Bad - Blank screen during async work
const handleAction = async () => {
  await updateConfigField('org', orgName);  // User sees nothing
  await clearAllProgress();                 // Still nothing
  setRunning(true);                         // Finally shows spinner
  await runSetup();
};
```

**Rules:**
- ✅ Set `running` and `viewState` BEFORE any async operations
- ✅ Add optional 10ms delay in `onStepComplete` callbacks if animations don't show
- ❌ Never use IIFE pattern `(async () => { ... })()` - make handler async instead
- ❌ Never use `setTimeout` before showing loading state

### 16. Bun-Native Resume Tests with VCR Fixtures

**Pattern:** Provider task tests use `bun:test`, `mock.module(...)`, and fixture-backed `VCR` helpers.

**Why:**
- ✅ Fast, deterministic task coverage without live provider calls
- ✅ Resume paths are easy to model by toggling progress flags in config
- ✅ Fixtures keep provider payloads readable and sanitized
- ✅ Matches the repo-wide move away from Vitest

**Current layout:**
```text
init/
├── tasks/tests/
│   ├── planetscaleResume.test.ts
│   ├── infisicalResume.test.ts
│   ├── railwayResume.test.ts
│   └── vercelBootstrapResume.test.ts
└── tests/
    ├── fixtures/
    │   ├── infisical/
    │   ├── railway/
    │   └── vercel/
    └── mocks/
        └── VCR.ts
```

**Testing guidance:**
- Unit test pure helpers directly
- Use task-level resume tests for provider workflows
- Record sanitized fixture values, then replay them via `VCR.require()`
- Mock module boundaries, not internal implementation details

---

## File Structure

```text
init/
├── index.tsx                  # Entry point
├── app.tsx                    # Main app with ConfigProvider
├── views/                     # UI components
│   ├── Prerequisites.tsx      # CLI/session checks
│   ├── MainMenu.tsx          # Task selection menu
│   ├── ProjectConfigView.tsx # Project name/org setup
│   ├── InfisicalSetupView.tsx# Infisical setup (reference impl)
│   ├── LaunchView.tsx        # Launch preflight + confirmation
│   └── ...                   # Other task views
├── tasks/                     # Business logic
│   ├── projectConfig.ts      # Project rename logic
│   ├── launch.ts             # Launch preflight + launched flag update
│   ├── infisicalSetup.ts     # Infisical API calls
│   └── ...                   # Other task logic
├── utils/
│   ├── configState.tsx       # ⭐ Root config context
│   ├── getProjectConfig.ts   # Config reader (cache-busted)
│   ├── prompts.ts            # ⭐ Composable prompt system
│   ├── progressTracking.ts  # markComplete/isComplete helpers
│   └── checkPrerequisites.ts# CLI/session check helpers
├── api/                       # Service API clients
│   ├── infisical.ts
│   └── ...
├── tasks/tests/               # Bun-native provider resume tests
├── tests/fixtures/            # Sanitized provider fixtures
├── tests/mocks/               # Shared VCR/config/system mocks
└── components/                # Reusable components
    └── OrgSelector.tsx
```

---

## Creating a New Task View

Follow the Infisical setup as reference implementation:

### 1. Create View Component

```typescript
// views/RenderSetupView.tsx
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

export const RenderSetupView: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [running, setRunning] = useState(false);

  // Derive state from config (no flash)
  const setupState = useMemo(
    () => config ? detectSetupState(config) : 'new',
    [config]
  );

  // Handle escape key
  useInput((input, key) => {
    if (key.escape && !running) onCancel();
  });

  const runSetup = async () => {
    setRunning(true);
    await setupRender(syncConfig); // Pass syncConfig for live updates
    await syncConfig();
    setRunning(false);
    setTimeout(() => onComplete(), 2000);
  };

  // Show all steps with status
  const progressItems = getProgressDisplay(config);
  const currentStepIndex = running ? progressItems.findIndex(item => !item.completed) : -1;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Render Setup</Text>

      <Box flexDirection="column" marginTop={1}>
        {progressItems.map((item, i) => {
          const isCompleted = item.completed;
          const isInProgress = running && i === currentStepIndex;
          const isPending = !isCompleted && !isInProgress;

          return (
            <Box key={i}>
              {isCompleted && <Text color="green">✓ {item.label}</Text>}
              {isInProgress && <Text color="cyan"><Spinner /> {item.label}</Text>}
              {isPending && <Text dimColor>− {item.label}</Text>}
            </Box>
          );
        })}
      </Box>

      {!running && (
        <Box marginTop={1}>
          <Text dimColor>{prompt(['enter', 'cancel'])}</Text>
        </Box>
      )}
    </Box>
  );
};
```

### 2. Create Task Function

```typescript
// tasks/renderSetup.ts
export const setupRender = async (
  config: ProjectConfig,
  onStepComplete?: () => Promise<void>
): Promise<void> => {
  // IMPORTANT: Receive config as parameter from view (don't call getProjectConfig)
  // This ensures you're using the same config the view is showing
  const projectName = config.project.name;

  // Step 1
  // ... API calls ...
  markComplete('render', 'createService');
  await onStepComplete?.(); // Trigger UI update

  // Step 2
  // ... API calls ...
  markComplete('render', 'deployApp');
  await onStepComplete?.(); // Trigger UI update

  // ... etc
};
```

**Critical:** Always receive `config` as a parameter. Never call `getProjectConfig()` directly in task functions - this can cause config mismatches where the task sees different data than the UI.

### 3. Wire Up in App

```typescript
// app.tsx
import { RenderSetupView } from './views/RenderSetupView';

{currentTask === 'render' && (
  <RenderSetupView onComplete={handleTaskComplete} onCancel={handleTaskCancel} />
)}
```

---

## Key Takeaways

1. **Use Context for shared state** - No prop drilling, single source of truth
2. **Derive state with useMemo** - No flash/delay, always in sync
3. **Manual sync, not polling** - More efficient, instant updates
4. **Cache-bust imports** - Fresh config on every read
5. **Composable prompts** - Consistent ordering everywhere
6. **Show all steps upfront** - User sees full picture, not streaming logs
7. **No console logs in tasks** - TUI handles all output
8. **Always fetch from source** - Infisical for secrets, config for metadata
9. **Retry async operations** - Handle cloud provisioning delays gracefully

See `InfisicalSetupView.tsx` and `PlanetScaleSetupView.tsx` for complete reference implementations.
