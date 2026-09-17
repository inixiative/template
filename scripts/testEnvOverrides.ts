import { afterEach } from 'bun:test';
import { installEnvOverrideProxy, resetEnvOverrides } from '../packages/shared/src/utils/envOverrides';

// Package tests (packages/db, packages/email, …) run root-invoked without apps/api's
// env bootstrap, so the override proxy is installed here. The afterEach backstop clears
// any override a test registered (setEnvOverride / withEnv) before the next test runs.
installEnvOverrideProxy();
afterEach(resetEnvOverrides);
