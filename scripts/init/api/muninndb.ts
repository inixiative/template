/**
 * MuninnDB API client
 *
 * Known risks / unverified paths:
 *   - Health endpoint: tries /health on the REST API base URL (port 8475 local, Railway public URL).
 *     If unreachable, also tries /mcp/health on the MCP base URL.
 *   - /api/admin/keys path is unverified against a live instance.
 *     Fallback: return adminToken directly as team token.
 */

/**
 * Check if a MuninnDB instance is healthy.
 * Tries GET /health; returns true on 200-level response.
 */
export const checkHealth = async (baseUrl: string): Promise<boolean> => {
	try {
		const response = await fetch(`${baseUrl}/health`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000),
		});
		return response.ok;
	} catch {
		return false;
	}
};

/**
 * Seed an engram into a vault, implicitly creating the vault.
 * Uses the MCP JSON-RPC `tools/call` protocol with the `store_memory` tool.
 * ⚠ Tool name may differ — adjust if MuninnDB uses a different method name.
 */
export const initializeVault = async (
	mcpUrl: string,
	token: string,
	vaultName: string
): Promise<void> => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(mcpUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'tools/call',
			params: {
				name: 'store_memory',
				arguments: {
					vault: vaultName,
					content: 'Team vault initialized by project setup.',
					tags: ['init', 'team'],
				},
			},
			id: 1,
		}),
	});

	// Non-fatal: vault seeding is best-effort
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Failed to seed vault "${vaultName}": ${response.status} ${body}`);
	}
};

/**
 * Generate a scoped team token via the MuninnDB admin API.
 * ⚠ /api/admin/keys path is unverified — falls back to returning adminToken directly.
 */
export const generateTeamToken = async (
	baseUrl: string,
	adminToken: string
): Promise<string> => {
	if (!adminToken) {
		// No admin token available — Railway instance may not require auth
		return '';
	}

	try {
		const response = await fetch(`${baseUrl}/api/admin/keys`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${adminToken}`,
			},
			body: JSON.stringify({ scope: 'vault:team', name: 'team-token' }),
			signal: AbortSignal.timeout(10000),
		});

		if (response.ok) {
			const data = (await response.json()) as { token?: string; key?: string };
			const token = data.token ?? data.key;
			if (token) return token;
		}
	} catch {
		// Fall through to fallback
	}

	// Fallback: use admin token directly as team token
	return adminToken;
};
