import { describe, expect, it } from 'bun:test';
import { describeError } from '@template/ui/lib/describeError';

describe('describeError', () => {
  it('pairs a friendly message with the raw error as detail', () => {
    expect(describeError(new Error('Invalid email or password'), 'Log in failed.')).toEqual({
      message: 'Log in failed.',
      detail: 'Invalid email or password',
    });
  });

  it('keeps bare OAuth codes as detail', () => {
    expect(describeError('state_mismatch', 'Log in failed.')).toEqual({
      message: 'Log in failed.',
      detail: 'state_mismatch',
    });
  });

  it('reads better-auth client error objects', () => {
    expect(describeError({ status: 401, statusText: 'Unauthorized', code: 'INVALID_TOKEN' }, 'x').detail).toBe(
      'INVALID_TOKEN',
    );
  });

  it('omits detail when there is no raw message or it repeats the friendly one', () => {
    expect(describeError(undefined, 'Log in failed.')).toEqual({ message: 'Log in failed.', detail: undefined });
    expect(describeError('Log in failed.', 'Log in failed.')).toEqual({ message: 'Log in failed.', detail: undefined });
  });

  it('without a friendly message, shows the raw error with stack or body as detail', () => {
    const error = new Error('boom');
    expect(describeError(error)).toEqual({ message: 'boom', detail: error.stack });
    expect(describeError({ error: 'Nope' })).toEqual({
      message: 'Nope',
      detail: JSON.stringify({ error: 'Nope' }, null, 2),
    });
    expect(describeError(42)).toEqual({ message: '42' });
  });
});
