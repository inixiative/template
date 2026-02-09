import { configSchema, Generator } from '@tanstack/router-generator';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const generatedRouteTree = './app/routeTree.gen.ts';
const config = configSchema.parse({
  target: 'react',
  disableLogging: true,
  routesDirectory: './app/routes',
  generatedRouteTree,
  tmpDir: './.tanstack/tmp',
});

await rm(resolve(root, generatedRouteTree), { force: true });
const generator = new Generator({ config, root });
await generator.run();

console.log('generated route tree for superadmin');
