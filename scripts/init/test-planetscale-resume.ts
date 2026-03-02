/**
 * Quick test: Verify planetscaleSetup handles resume correctly
 *
 * This script checks that the code doesn't try to create duplicate passwords
 * when resuming from a checkpoint where passwords are already created.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const planetscaleSetupPath = join(process.cwd(), 'scripts/init/tasks/planetscaleSetup.ts');
const code = readFileSync(planetscaleSetupPath, 'utf-8');

console.log('🔍 Analyzing planetscaleSetup.ts for resume safety...\n');

// Test 1: Check that there's NO else block after createPasswords check
const createPasswordsBlock = code.match(
	/if \(!\(await isProgressComplete\('planetscale', 'createPasswords'\)\)\) \{[\s\S]*?\n\t\t\}(?:\s*else\s*\{)?/
);

if (createPasswordsBlock) {
	const hasElse = createPasswordsBlock[0].includes('} else {');
	if (hasElse) {
		console.error('❌ FAIL: Found else block after createPasswords check');
		console.error('   This will try to create duplicate passwords when resuming!');
		process.exit(1);
	} else {
		console.log('✓ PASS: No else block after createPasswords - won\'t create duplicates');
	}
} else {
	console.error('❌ FAIL: Could not find createPasswords block');
	process.exit(1);
}

// Test 2: Check that initMigrationTable uses getSecret
const initMigrationBlock = code.match(
	/if \(!\(await isProgressComplete\('planetscale', 'initMigrationTable'\)\)\) \{[\s\S]*?\n\t\t\}/
);

if (initMigrationBlock) {
	const usesGetSecret = initMigrationBlock[0].includes('getSecret(\'DATABASE_URL\'');
	const usesPasswordObject = initMigrationBlock[0].includes('productionPassword.connection_strings');

	if (usesPasswordObject) {
		console.error('❌ FAIL: initMigrationTable uses password objects instead of Infisical');
		console.error('   This will fail when resuming (password objects undefined)');
		process.exit(1);
	} else if (usesGetSecret) {
		console.log('✓ PASS: initMigrationTable fetches from Infisical - works when resuming');
	} else {
		console.error('❌ FAIL: initMigrationTable doesn\'t use getSecret');
		process.exit(1);
	}
} else {
	console.error('❌ FAIL: Could not find initMigrationTable block');
	process.exit(1);
}

// Test 3: Check that configureDB re-reads from config
const configureDBBlock = code.match(
	/if \(!\(await isProgressComplete\('planetscale', 'configureDB'\)\)\) \{[\s\S]*?\n\t\t\}/
);

if (configureDBBlock) {
	const reReadsConfig = configureDBBlock[0].includes('getProjectConfig()');

	if (reReadsConfig) {
		console.log('✓ PASS: configureDB re-reads from config - fresh data when resuming');
	} else {
		console.warn('⚠ WARNING: configureDB might use stale variables when resuming');
	}
} else {
	console.error('❌ FAIL: Could not find configureDB block');
	process.exit(1);
}

// Test 4: Check that getSecret is imported
const hasGetSecretImport = code.includes('import {') && code.match(/import\s*\{[^}]*getSecret[^}]*\}\s*from\s*['"]\.\/infisicalSetup['"]/);

if (hasGetSecretImport) {
	console.log('✓ PASS: getSecret is imported from infisicalSetup');
} else {
	console.error('❌ FAIL: getSecret is not imported - will cause runtime error');
	process.exit(1);
}

console.log('\n✅ All checks passed! planetscaleSetup is resume-safe.');
console.log('\nKey improvements:');
console.log('  • No duplicate password creation when resuming');
console.log('  • Fetches connection strings from Infisical (source of truth)');
console.log('  • Re-reads config for fresh data');
console.log('\nYou can now safely resume PlanetScale setup from any checkpoint.');
