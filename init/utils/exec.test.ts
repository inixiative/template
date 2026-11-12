import { describe, expect, it } from 'bun:test';
import { execFileWithInput } from './exec';

describe('execFileWithInput', () => {
  it('hands the input to the command on stdin', async () => {
    const { stdout } = await execFileWithInput('cat', [], 'a-secret-value');
    expect(stdout).toBe('a-secret-value');
  });

  it('a failure shows what the command said, never the input', async () => {
    const failing = execFileWithInput(
      'sh',
      ['-c', 'cat >/dev/null; echo "set failed: bad project" >&2; exit 3'],
      'a-secret-value',
    );
    const error = (await failing.catch((caught: Error) => caught)) as Error;
    expect(error.message).toContain('set failed: bad project');
    expect(error.message).not.toContain('a-secret-value');
  });
});
