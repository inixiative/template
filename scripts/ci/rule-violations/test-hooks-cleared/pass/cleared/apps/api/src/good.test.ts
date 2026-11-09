import { afterEach, beforeEach } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import { registerRulesHook } from '#/hooks/rules/hook';

beforeEach(() => {
  registerRulesHook();
});

afterEach(clearHookRegistry);
