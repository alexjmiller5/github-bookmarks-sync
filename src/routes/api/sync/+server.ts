import { error, json } from '@sveltejs/kit';
import { runSync } from '$lib/sync/run';
import type { RequestHandler } from './$types';

/** Constant-time-ish equality that works in both workerd and node (tests):
 *  compare SHA-256 digests instead of the raw strings. */
async function tokenMatches(presented: string, expected: string): Promise<boolean> {
	const enc = new TextEncoder();
	const [a, b] = await Promise.all([
		crypto.subtle.digest('SHA-256', enc.encode(presented)),
		crypto.subtle.digest('SHA-256', enc.encode(expected))
	]);
	const av = new Uint8Array(a);
	const bv = new Uint8Array(b);
	let diff = 0;
	for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
	return diff === 0;
}

// Manual sync trigger. Shared-secret auth (SYNC_TOKEN Worker secret) until
// CF Access fronts this Worker — see README.
export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env?.SYNC_TOKEN) error(500, 'SYNC_TOKEN is not configured');

	const presented = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
	if (!(await tokenMatches(presented, env.SYNC_TOKEN))) error(401, 'unauthorized');

	const dryRun = new URL(request.url).searchParams.get('dry_run') === 'true';
	return json(await runSync(env, { trigger: 'manual', dryRun }));
};
