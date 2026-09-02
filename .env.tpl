# Canonical secrets manifest — 1Password secret references only, SAFE to commit.
# Worker bindings (D1, R2, KV) are NOT secrets — they go in wrangler.jsonc.
# Local dev:      op run --env-file=.env.tpl -- bun run dev
# Push to CF:     just sync-secrets
GITHUB_TOKEN=op://GitHub-Bookmarks-Sync/GitHub-Bookmarks-Sync GitHub PAT/token
NOTION_API_KEY=op://GitHub-Bookmarks-Sync/GitHub-Bookmarks-Sync Notion API Key/token
SYNC_TOKEN=op://GitHub-Bookmarks-Sync/GitHub-Bookmarks-Sync Sync Token/token
