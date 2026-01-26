import { $ } from 'bun';
import { dopplerConfig } from '../../doppler.config';

const { project, environments, apps } = dopplerConfig;

console.log(`Setting up Doppler: ${project}`);

await $`doppler projects create ${project}`.quiet().nothrow();

await $`doppler configs create root -p ${project}`.quiet().nothrow();
await $`doppler configs update -p ${project} -c root --inheritable=true -y`.quiet();

for (const env of environments) {
  await $`doppler configs create ${env} -p ${project}`.quiet().nothrow();
  await $`doppler configs update -p ${project} -c ${env} --inheritable=true --inherits=${project}.root -y`.quiet();
}

for (const env of environments) {
  for (const app of apps) {
    const config = `${env}_${app}`;
    await $`doppler configs create ${config} -p ${project}`.quiet().nothrow();
    await $`doppler configs update -p ${project} -c ${config} --inherits=${project}.${env} -y`.quiet();
  }
}

// Configure local project to use dev by default
await $`doppler setup --project ${project} --config dev`.quiet();

console.log('Done');
