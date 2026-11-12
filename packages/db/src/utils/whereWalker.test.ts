import { describe, expect, it } from 'bun:test';
import { matchNothing } from '@inixiative/json-rules';
import { walkWhere } from '@template/db/utils/whereWalker';

describe('walkWhere', () => {
  it('a scope clause that matches nothing makes the node match nothing', () => {
    const walked = walkWhere('User', { email: 'a@example.test' }, () => [
      matchNothing(),
      { name: 'Ada' },
    ]);
    expect(walked).toEqual(matchNothing());
  });

  it('folds several live clauses into one AND beside the node', () => {
    const walked = walkWhere('User', { email: 'a@example.test' }, () => [
      { name: 'Ada' },
      { email: 'b@example.test' },
    ]);
    expect(walked).toEqual({
      AND: [{ email: 'a@example.test' }, { name: 'Ada' }, { email: 'b@example.test' }],
    });
  });
});
