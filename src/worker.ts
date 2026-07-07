/**
 * Real Worker entrypoint (`main` in wrangler.jsonc): wraps the SvelteKit
 * adapter build output to add a `scheduled()` handler, which the adapter
 * cannot emit. The adapter is pointed at wrangler.build.jsonc (see
 * vite.config.ts) so it writes to .svelte-kit/cloudflare/_worker.js instead
 * of overwriting this file. `vite build` must run before wrangler
 * bundles/deploys this (justfile `deploy` already does).
 */
// @ts-ignore build artifact — exists after `bun run build`
import sveltekit from '../.svelte-kit/cloudflare/_worker.js';
import { runSync } from './lib/sync/run';

const app = sveltekit as ExportedHandler<Env>;

export default {
	...app,
	scheduled(controller, env, ctx) {
		ctx.waitUntil(runSync(env, { trigger: 'cron' }));
	}
} satisfies ExportedHandler<Env>;
