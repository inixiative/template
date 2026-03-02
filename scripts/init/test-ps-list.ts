#!/usr/bin/env bun
import { getProjectConfig } from './utils/getProjectConfig';
import { getSecret } from './tasks/infisicalSetup';

const config = await getProjectConfig();
const projectId = config.infisical.projectId;
const token = getSecret('PLANETSCALE_TOKEN', { projectId, environment: 'root' });

console.log('Listing PlanetScale resources...\n');

// List organizations
console.log('1. GET /organizations');
const orgs = await fetch('https://api.planetscale.com/v1/organizations', {
	headers: { 'Authorization': token },
});
console.log('Status:', orgs.status);
const orgsData = await orgs.json();
console.log('Organizations:', JSON.stringify(orgsData, null, 2));

console.log('\n---\n');

// Try to get the specific org
const orgName = config.planetscale.organization;
console.log(`2. GET /organizations/${orgName}`);
const org = await fetch(`https://api.planetscale.com/v1/organizations/${orgName}`, {
	headers: { 'Authorization': token },
});
console.log('Status:', org.status);
const orgData = await org.json();
console.log('Org data:', JSON.stringify(orgData, null, 2));

console.log('\n---\n');

// List databases for the org
console.log(`3. GET /organizations/${orgName}/databases`);
const dbs = await fetch(`https://api.planetscale.com/v1/organizations/${orgName}/databases`, {
	headers: { 'Authorization': token },
});
console.log('Status:', dbs.status);
const dbsData = await dbs.json();
console.log('Databases:', JSON.stringify(dbsData, null, 2));
