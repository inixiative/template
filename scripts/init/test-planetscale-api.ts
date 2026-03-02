#!/usr/bin/env bun
import { getProjectConfig } from './utils/getProjectConfig';
import { getSecret } from './tasks/infisicalSetup';

const testPlanetScaleAPI = async () => {
	const config = await getProjectConfig();

	// Get token from environment or Infisical
	let token = process.env.PLANETSCALE_TOKEN;
	if (!token) {
		try {
			const projectId = config.infisical.projectId;
			token = getSecret('PLANETSCALE_TOKEN', {
				projectId,
				environment: 'root',
			});
		} catch (error) {
			console.error('Could not get token from Infisical. Set PLANETSCALE_TOKEN env var.');
			process.exit(1);
		}
	}

	const org = config.planetscale.organization || 'inixiative';
	const db = config.planetscale.database || 'template';

	console.log('Testing PlanetScale API endpoints...\n');

	// Test 1: GET database info
	console.log('1. GET /organizations/${org}/databases/${db}');
	try {
		const response = await fetch(`https://api.planetscale.com/v1/organizations/${org}/databases/${db}`, {
			headers: {
				'Authorization': token,
			},
		});
		console.log('Status:', response.status);
		const data = await response.json();
		console.log('Response:', JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('Error:', error);
	}

	console.log('\n---\n');

	// Test 2: PATCH database settings
	console.log('2. PATCH /organizations/${org}/databases/${db}');
	try {
		const response = await fetch(`https://api.planetscale.com/v1/organizations/${org}/databases/${db}`, {
			method: 'PATCH',
			headers: {
				'Authorization': token,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				allow_foreign_key_constraints: true,
				automatic_migrations: true,
				migration_table_name: '_prisma_migrations',
			}),
		});
		console.log('Status:', response.status);
		const data = await response.json();
		console.log('Response:', JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('Error:', error);
	}

	console.log('\n---\n');

	// Test 3: Try settings endpoint (if different)
	console.log('3. PATCH /organizations/${org}/databases/${db}/settings');
	try {
		const response = await fetch(`https://api.planetscale.com/v1/organizations/${org}/databases/${db}/settings`, {
			method: 'PATCH',
			headers: {
				'Authorization': token,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				allow_foreign_key_constraints: true,
				automatic_migrations: true,
				migration_table_name: '_prisma_migrations',
			}),
		});
		console.log('Status:', response.status);
		const data = await response.json();
		console.log('Response:', JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('Error:', error);
	}
};

testPlanetScaleAPI().catch(console.error);
