#!/usr/bin/env bun
// One-off: run the full sync from this machine (real writes unless --dry-run).
//   op run --env-file=.env.tpl -- bun scripts/dry-run.ts --dry-run
import { runSync } from '../src/lib/sync/run';

const dryRun = Bun.argv.includes('--dry-run');
const { GITHUB_TOKEN, NOTION_API_KEY } = Bun.env;
if (!GITHUB_TOKEN || !NOTION_API_KEY) {
	console.error(
		'Missing GITHUB_TOKEN / NOTION_API_KEY — run via: op run --env-file=.env.tpl -- bun scripts/dry-run.ts'
	);
	process.exit(1);
}

const summary = await runSync({ GITHUB_TOKEN, NOTION_API_KEY }, { trigger: 'script', dryRun });

console.log(`\n${dryRun ? 'DRY RUN — nothing written' : 'Sync complete'}`);
console.log(`starred=${summary.starred} created=${summary.created} skipped=${summary.skipped}`);
console.log(`toCreate (${summary.toCreate.length}):`);
for (const name of summary.toCreate) console.log(`  + ${name}`);
console.log(`unstarred, kept in Notion (${summary.unstarred.length}):`);
for (const url of summary.unstarred) console.log(`  - ${url}`);
if (summary.errors.length) {
	console.error(`errors (${summary.errors.length}):`);
	for (const e of summary.errors) console.error(`  ! ${e}`);
	process.exit(1);
}
