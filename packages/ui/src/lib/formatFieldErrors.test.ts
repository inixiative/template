import { describe, expect, it } from 'bun:test';
import { formatFieldErrors } from '@template/ui/lib/formatFieldErrors';

describe('formatFieldErrors', () => {
  it('prefixes each message with its field path', () => {
    expect(
      formatFieldErrors({
        email: ['Invalid email address'],
        'owner.id': ['Required', 'Too short'],
      }),
    ).toBe('email: Invalid email address; owner.id: Required; owner.id: Too short');
  });

  it('leaves a root-level message unprefixed', () => {
    expect(formatFieldErrors({ '': ['Expected object'] })).toBe('Expected object');
  });
});
