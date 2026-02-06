#!/usr/bin/env bun
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const WATCH_PATHS = [resolve(__dirname, '../../apps/api'), resolve(__dirname, '../../packages/db/prisma')];
const WATCH_EXTENSIONS = ['.ts', '.tsx', '.prisma'];
const DEBOUNCE_MS = 500;
const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';
const MAX_WAIT_ATTEMPTS = 30;
const API_RETRY_INTERVAL_MS = 2000;

let debounceTimer: Timer | null = null;
let isGenerating = false;
let isPendingGeneration = false;
let apiCheckInterval: Timer | null = null;

const waitForAPI = async (): Promise<boolean> => {
  for (let attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

const quickHealthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const startAPIPolling = () => {
  if (apiCheckInterval) return;
  isPendingGeneration = true;
  apiCheckInterval = setInterval(async () => {
    const isAvailable = await quickHealthCheck();
    if (isAvailable && isPendingGeneration) {
      if (apiCheckInterval) {
        clearInterval(apiCheckInterval);
        apiCheckInterval = null;
      }
      isPendingGeneration = false;
      await generateSDK(true);
    }
  }, API_RETRY_INTERVAL_MS);
};

const stopAPIPolling = () => {
  if (apiCheckInterval) {
    clearInterval(apiCheckInterval);
    apiCheckInterval = null;
  }
  isPendingGeneration = false;
};

const generateSDK = async (skipHealthCheck = false) => {
  if (isGenerating) return;
  isGenerating = true;

  if (!skipHealthCheck) {
    const isAvailable = await quickHealthCheck();
    if (!isAvailable) {
      isGenerating = false;
      startAPIPolling();
      return;
    }
  }

  try {
    const proc = spawn('bun', ['run', 'generate:api'], {
      cwd: __dirname,
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    await new Promise<void>((resolve, reject) => {
      proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
      proc.on('error', reject);
    });

    stopAPIPolling();
  } catch (error) {
    console.error('SDK generation failed:', error instanceof Error ? error.message : String(error));
    stopAPIPolling();
  } finally {
    isGenerating = false;
  }
};

const handleChange = (filename: string) => {
  if (!WATCH_EXTENSIONS.some((ext) => filename.endsWith(ext))) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => generateSDK(), DEBOUNCE_MS);
};

const startWatching = () => {
  for (const path of WATCH_PATHS) {
    const watcher = watch(path, { recursive: true }, (_eventType, filename) => {
      if (filename) handleChange(filename);
    });
    watcher.on('error', (error) => console.error(`Watcher error for ${path}:`, error));
  }
};

startWatching();
waitForAPI().then((apiReady) => apiReady && generateSDK(true));

process.on('SIGINT', () => {
  stopAPIPolling();
  process.exit(0);
});
