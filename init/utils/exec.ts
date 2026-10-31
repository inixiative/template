import { type ExecFileOptions, exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
// No shell: arguments are passed verbatim, so values containing quotes, `$`,
// or backticks can't inject commands or silently corrupt. Prefer this whenever
// any argument is interpolated.
export const execFileAsync = promisify(execFile);

// The input goes to the child's stdin, so a secret never appears in argv,
// a process listing, or a failed command's message.
export const execFileWithInput = (
  file: string,
  args: string[],
  input: string,
  options: ExecFileOptions = {},
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      { ...options, encoding: 'utf-8' },
      (error, stdout, stderr) => (error ? reject(error) : resolve({ stdout, stderr })),
    );
    child.stdin?.end(input);
  });
