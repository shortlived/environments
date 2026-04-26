#!/usr/bin/env bash
# resolve_secrets.sh — Unified secret resolution: Conjur → Azure Key Vault → Env/Inputs
# Usage: source ./scripts/resolve_secrets.sh
#        resolve_secrets <secret_name> [provider]
#        resolve_single_secret <secret_path> [provider]
#
# Provider priority (unless overridden):
#   1. conjur    — if CONJUR_API_KEY, CONJUR_URL, CONJUR_SAFE are set
#   2. azure     — if AZURE_KEY_VAULT_NAME is set (uses az cli)
#   3. inputs    — environment variables / workflow inputs
set -euo pipefail

source ./scripts/colors.sh 2>/dev/null || true

# Detect which secret providers are available
detect_providers() {
  local providers=()

  if [ -n "${CONJUR_API_KEY:-}" ] && [ -n "${CONJUR_URL:-}" ] && [ -n "${CONJUR_SAFE:-}" ]; then
    providers+=("conjur")
  fi

  if [ -n "${AZURE_KEY_VAULT_NAME:-}" ]; then
    providers+=("azure")
  fi

  providers+=("inputs")
  echo "${providers[*]}"
}

# Resolve a single secret from Conjur
resolve_from_conjur() {
  local secret_path="$1"
  local token

  if [ -z "${CONJUR_API_KEY:-}" ] || [ -z "${CONJUR_URL:-}" ] || [ -z "${CONJUR_SAFE:-}" ]; then
    return 1
  fi

  local account="${CONJUR_ACCOUNT:-default}"
  local login="${CONJUR_LOGIN:-host/github-actions}"

  # Authenticate
  token=$(curl -s --fail \
    -H "Accept-Encoding: base64" \
    -d "$CONJUR_API_KEY" \
    "${CONJUR_URL}/authn/${account}/${login}/authenticate" 2>/dev/null) || return 1

  # Retrieve secret
  local encoded_path
  encoded_path=$(echo -n "${CONJUR_SAFE}/${secret_path}" | jq -sRr @uri)

  curl -s --fail \
    -H "Authorization: Token token=\"${token}\"" \
    "${CONJUR_URL}/secrets/${account}/variable/${encoded_path}" 2>/dev/null || return 1
}

# Resolve a single secret from Azure Key Vault
resolve_from_azure() {
  local secret_name="$1"

  if [ -z "${AZURE_KEY_VAULT_NAME:-}" ]; then
    return 1
  fi

  az keyvault secret show \
    --vault-name "$AZURE_KEY_VAULT_NAME" \
    --name "$secret_name" \
    --query "value" -o tsv 2>/dev/null || return 1
}

# Resolve a single secret from environment / inputs
resolve_from_inputs() {
  local secret_name="$1"
  local env_name
  env_name=$(echo "$secret_name" | tr '[:lower:]/-' '[:upper:]__')

  local value="${!env_name:-}"
  if [ -n "$value" ]; then
    echo "$value"
    return 0
  fi
  return 1
}

# Main resolution function — tries providers in order
resolve_single_secret() {
  local secret_name="$1"
  local preferred_provider="${2:-auto}"
  local value=""

  if [ "$preferred_provider" != "auto" ]; then
    case "$preferred_provider" in
      conjur) value=$(resolve_from_conjur "$secret_name") && echo "$value" && return 0 ;;
      azure)  value=$(resolve_from_azure "$secret_name") && echo "$value" && return 0 ;;
      inputs) value=$(resolve_from_inputs "$secret_name") && echo "$value" && return 0 ;;
    esac
    return 1
  fi

  # Auto: try in priority order
  if [ -n "${CONJUR_API_KEY:-}" ]; then
    value=$(resolve_from_conjur "$secret_name" 2>/dev/null) && echo "$value" && return 0
  fi

  if [ -n "${AZURE_KEY_VAULT_NAME:-}" ]; then
    value=$(resolve_from_azure "$secret_name" 2>/dev/null) && echo "$value" && return 0
  fi

  value=$(resolve_from_inputs "$secret_name" 2>/dev/null) && echo "$value" && return 0

  return 1
}

# Resolve multiple secrets — exports them as env vars
resolve_secrets() {
  local provider="${SECRET_PROVIDER:-auto}"
  local secrets=("$@")

  if [ ${#secrets[@]} -eq 0 ]; then
    echo "Usage: resolve_secrets SECRET_NAME [SECRET_NAME ...]"
    echo "Set SECRET_PROVIDER=conjur|azure|inputs to force a provider."
    return 1
  fi

  echo "Resolving secrets (provider: $provider)..."
  local available
  available=$(detect_providers)
  echo "Available providers: $available"

  local failed=()
  for secret in "${secrets[@]}"; do
    local value
    value=$(resolve_single_secret "$secret" "$provider" 2>/dev/null) || {
      failed+=("$secret")
      continue
    }
    local env_name
    env_name=$(echo "$secret" | tr '[:lower:]/-' '[:upper:]__')
    export "$env_name=$value"
    echo -e "  ${GREEN:-}✓${ENDCOLOR:-} $secret → \$$env_name"
  done

  if [ ${#failed[@]} -gt 0 ]; then
    echo -e "${RED:-}✗ Failed to resolve: ${failed[*]}${ENDCOLOR:-}"
    return 1
  fi

  echo -e "${GREEN:-}✓ All secrets resolved${ENDCOLOR:-}"
}
