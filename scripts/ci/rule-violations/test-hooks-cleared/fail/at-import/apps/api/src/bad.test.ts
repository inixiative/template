import { afterEach } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import { registerRulesHook } from '#/hooks/rules/hook';

// Forbidden: registered once at import, gone after the first clear.
registerRulesHook();

afterEach(clearHookRegistry);
