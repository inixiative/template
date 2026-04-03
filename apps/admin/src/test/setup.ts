/**
 * Test preload — registered via bunfig.toml [test].preload
 * Registers happy-dom globally for DOM testing.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
