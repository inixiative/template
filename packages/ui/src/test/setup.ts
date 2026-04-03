/**
 * Test preload — registered via bunfig.toml [test].preload
 *
 * Registers happy-dom globally so all test files get a real DOM environment
 * (document, window, navigator, etc.) without per-file pragmas.
 *
 * This is the official bun approach for DOM testing:
 * https://bun.sh/docs/test/dom
 *
 * IMPORTANT: This file must ONLY call GlobalRegistrator.register().
 * Do NOT import @testing-library/react or other libs here — ES module
 * imports are hoisted, and those libs evaluate before the DOM exists.
 * If you need a second preload for testing-library setup, add a
 * separate file to the bunfig.toml preload array.
 *
 * TODO: When bun adds per-file environment control (like Vitest's
 * @vitest-environment pragma), consider switching to opt-in DOM
 * per test file instead of global. Track: oven-sh/bun#3554
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
