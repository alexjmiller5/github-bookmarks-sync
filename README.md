# github-bookmarks-sync

One-way sync of GitHub starred repos into the Notion Bookmarks DB. Upserts
by repo URL (the unique key), tags each entry "Github". Runs as a Cloudflare
Worker: a CF cron trigger plus a manual sync endpoint, with a minimal status
page.

Architecture notes:

- **Cloudflare Worker, not the Python/Modal default** — per the project note
  ("try cloudflare r2 workers instead because gcp was a pain with
  terraform"). `wrangler.jsonc` IS the IaC, so no terraform module is needed.
- **No R2 for the MVP** — sync state lives in the Notion Bookmarks DB itself
  (URL is the unique key), so no blob storage is needed. ponytail: add an R2
  binding to wrangler.jsonc only if we later need caching beyond Notion.

## Sync semantics (assumptions)

- **One-way, GitHub → Notion.** The project title says "↔" but the valuable
  direction ships first; bidirectional can come later.
- **Never deletes.** A repo that gets un-starred is only reported
  (`diffStars().unstarred`) — bookmarks may be kept intentionally.
- **Upsert key** is the normalized URL (lowercase host, no trailing slash).
- **Field mapping** (verified against existing Github-tagged Bookmarks rows):
  `Description` (the DB's title property) = repo description,
  `Title` (rich_text) = `owner/repo: description`, `URL` = repo html_url,
  `Tags` = `["Github"]`. Repos without a description use `owner/repo` for
  both text fields.

Core logic lives in `src/lib/sync/` (`github.ts`, `notion.ts`, `diff.ts`),
framework-free with vitest specs alongside.

## Layout

```
src/routes/       pages + server routes (sync endpoint lives here)
src/routes/layout.css   Tailwind + @theme design tokens
wrangler.jsonc    the IaC — bindings, cron triggers, domain
.env.tpl          secrets manifest (1Password op:// refs, committed)
justfile          dev / test / check / fmt / build / logs / sync-secrets / deploy
```

## Commands

`just dev` · `just test` · `just check` · `just fmt` · `just build` ·
`just logs` · `just sync-secrets` · `just deploy`

## One-time setup (Alex)

The Claude shell's 1Password service account cannot create vaults or service
accounts, so these are manual. Run once:

```bash
# 1. Project vault + credential items
op vault create "GitHub-Bookmarks-Sync"
op item create --category "API Credential" --title "GitHub PAT" \
  --vault "GitHub-Bookmarks-Sync" "token[concealed]=<a GitHub PAT with read:user scope, for reading your starred repos>"
op item create --category "API Credential" --title "Notion Integration" \
  --vault "GitHub-Bookmarks-Sync" "token[concealed]=<a Notion internal integration secret with access to the Bookmarks DB>"
# CI deploy creds (used by .github/workflows/deploy.yml)
op item create --category "API Credential" --title "cloudflare" \
  --vault "GitHub-Bookmarks-Sync" \
  "api-token[concealed]=<CF API token with Workers edit>" \
  "account-id[text]=<CF account id>"

# 2. Read-only CI service account, token stored in Personal
OUT=$(op service-account create "github-bookmarks-sync-ci" \
  --vault "GitHub-Bookmarks-Sync:read_items" --format json </dev/null)
op item create --category "API Credential" \
  --title "github-bookmarks-sync-ci SA Token" --vault Personal \
  "token[concealed]=$(echo "$OUT" | jq -r .token)" </dev/null

# 3. GitHub repo + the single CI secret
gh repo create alexjmiller5/github-bookmarks-sync --private --source . --push
gh secret set OP_SERVICE_ACCOUNT_TOKEN \
  --body "$(op read 'op://Personal/github-bookmarks-sync-ci SA Token/token')"
```

Also share the Notion integration with the Bookmarks DB (Notion UI:
Bookmarks DB → connections → add the integration).
