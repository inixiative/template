import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_SEMVER = /(\d+\.\d+\.\d+(?:-[\w.]+)?)/;

type CliVersionOptions = {
  command?: string;
  regex?: RegExp;
};

export const cliVersion = async (cmd: string, opts: CliVersionOptions = {}): Promise<string> => {
  const command = opts.command ?? '--version';
  const regex = opts.regex ?? DEFAULT_SEMVER;
  const { stdout, stderr } = await execAsync(`${cmd} ${command}`);
  const output = `${stdout}\n${stderr}`;
  const match = output.match(regex);
  if (!match) throw new Error(`cliVersion("${cmd} ${command}"): no version match in "${output.trim()}"`);
  return match[1];
};
