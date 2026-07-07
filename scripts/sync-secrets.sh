#!/usr/bin/env bash
# Push .env.tpl secrets to the Worker. op:// refs resolve via `op inject`
# (needs OP_SERVICE_ACCOUNT_TOKEN or a signed-in op); wrangler needs
# CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. No plaintext touches disk.
# Shared by `just sync-secrets` and the deploy workflow.
set -euo pipefail
op inject -i .env.tpl | grep -v '^#' | grep . | while IFS='=' read -r k v; do
  printf '%s' "$v" | bunx wrangler secret put "$k"
done
