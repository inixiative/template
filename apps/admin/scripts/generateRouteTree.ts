import { configSchema, Generator } from '@tanstack/router-generator';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const config = configSchema.parse({
  target: 'react',
  disableLogging: true,
  routesDirectory: './app/routes',
  generatedRouteTree: './app/routeTree.gen.ts',
});

const generator = new Generator({ config, root });
await generator.run();

console.log('generated route tree for admin');
