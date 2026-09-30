import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
// No shell: arguments are passed verbatim, so values containing quotes, `$`,
// or backticks can't inject commands or silently corrupt. Prefer this whenever
// any argument is interpolated.
export const execFileAsync = promisify(execFile);
