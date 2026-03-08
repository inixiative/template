#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink';
import React from 'react';
import { App } from './app.js';

// Copy .env.init.example to .env.init if it doesn't exist
const envInitPath = join(process.cwd(), '.env.init');
const envInitExamplePath = join(process.cwd(), '.env.init.example');

if (!existsSync(envInitPath) && existsSync(envInitExamplePath)) {
  copyFileSync(envInitExamplePath, envInitPath);
}

// Render the app and wait for it to exit
(async () => {
  try {
    // Ensure stdin is in raw mode and stays alive
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.ref(); // Prevent process from exiting
    }

    const instance = render(<App />, {
      exitOnCtrlC: true,
      patchConsole: true,
    });

    await instance.waitUntilExit();
  } catch (error) {
    console.error('Error running init script:', error);
    process.exit(1);
  }
})();
