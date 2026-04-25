#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink';
import { App } from './app.js';

// Copy .env.init.example to .env.init if it doesn't exist
const envInitPath = join(process.cwd(), '.env.init');
const envInitExamplePath = join(process.cwd(), '.env.init.example');

if (!existsSync(envInitPath) && existsSync(envInitExamplePath)) {
  copyFileSync(envInitExamplePath, envInitPath);
}

// Hard exit fallback — Ctrl+C in raw mode sends \x03 (not SIGINT),
// but macOS PTY still sends SIGINT to the process group. This ensures
// we always exit even if Ink's exitOnCtrlC handler is blocked by a hung exec.
process.on('SIGINT', () => process.exit(0));

// Surface async errors instead of letting them silently kill the TUI.
// Without these, an unhandled rejection in any check causes Bun to exit
// with a stale Ink frame still on screen and no diagnostic.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('\n[init] UNHANDLED REJECTION:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('\n[init] UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

// Render the app and wait for it to exit
(async () => {
  try {
    // Ensure stdin is in raw mode and stays alive
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.ref(); // Prevent process from exiting
    }

    // patchConsole=false so error output lands in the terminal instead of
    // being swallowed by Ink. Re-enable once init is stable.
    const instance = render(<App />, {
      exitOnCtrlC: true,
      patchConsole: false,
    });

    await instance.waitUntilExit();
  } catch (error) {
    console.error('Error running init script:', error);
    process.exit(1);
  }
})();
