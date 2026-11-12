import { beforeEach } from 'bun:test';
import { registerRulesHook } from '#/hooks/rules/hook';

// Forbidden: the hook stays registered for whichever test file runs next.
beforeEach(() => {
  registerRulesHook();
});
