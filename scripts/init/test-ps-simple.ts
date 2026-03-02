#!/usr/bin/env bun

// Paste your token here:
const TOKEN = 'your_token_here';
const ORG = 'inixiative';
const DB = 'template';

console.log('Testing PlanetScale API endpoints...\n');

// Test 1: GET database
console.log(`1. GET /organizations/${ORG}/databases/${DB}`);
const get1 = await fetch(`https://api.planetscale.com/v1/organizations/${ORG}/databases/${DB}`, {
	headers: { 'Authorization': TOKEN },
});
console.log('Status:', get1.status);
console.log('Response:', await get1.text());

console.log('\n---\n');

// Test 2: PATCH database
console.log(`2. PATCH /organizations/${ORG}/databases/${DB}`);
const patch1 = await fetch(`https://api.planetscale.com/v1/organizations/${ORG}/databases/${DB}`, {
	method: 'PATCH',
	headers: {
		'Authorization': TOKEN,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		allow_foreign_key_constraints: true,
		automatic_migrations: true,
		migration_table_name: '_prisma_migrations',
	}),
});
console.log('Status:', patch1.status);
console.log('Response:', await patch1.text());

console.log('\n---\n');

// Test 3: PATCH settings endpoint
console.log(`3. PATCH /organizations/${ORG}/databases/${DB}/settings`);
const patch2 = await fetch(`https://api.planetscale.com/v1/organizations/${ORG}/databases/${DB}/settings`, {
	method: 'PATCH',
	headers: {
		'Authorization': TOKEN,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		allow_foreign_key_constraints: true,
		automatic_migrations: true,
		migration_table_name: '_prisma_migrations',
	}),
});
console.log('Status:', patch2.status);
console.log('Response:', await patch2.text());
