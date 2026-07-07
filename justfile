set shell := ["bash", "-cu"]

default:
    @just --list

# Dev server (secrets injected if .env.tpl has any)
dev:
    op run --env-file=.env.tpl -- bun run dev

test:
    bun run test

# All static analysis: wrangler types + svelte-check + prettier (read-only)
check:
    bun run check && bun run lint

fmt:
    bun run format

build:
    bun run build

# Stream logs from the deployed Worker
logs:
    bunx wrangler tail

# Push .env.tpl secrets to the Worker (no plaintext touches disk)
sync-secrets:
    ./scripts/sync-secrets.sh

deploy: test build
    bunx wrangler deploy

# --- project-specific recipes below (one-offs live in scripts/, run directly) ---
