#!/usr/bin/env bash
# transcrypt_bootstrap.sh — Auto-bootstrap transcrypt using GH repo secrets
set -euo pipefail

source ./scripts/colors.sh 2>/dev/null || true

transcrypt_bootstrap() {
  local repo
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")

  if [ -z "$repo" ]; then
    echo -e "${RED:-}ERROR: Could not determine GitHub repo. Is 'gh' authenticated?${ENDCOLOR:-}"
    echo "Run: gh auth login"
    return 1
  fi

  echo "Repository: $repo"

  local has_secret=false
  if gh secret list -R "$repo" 2>/dev/null | grep -q "^TRANSCRYPT_PASSWORD"; then
    has_secret=true
    echo -e "${GREEN:-}✓ TRANSCRYPT_PASSWORD repo secret exists${ENDCOLOR:-}"
  else
    echo -e "${YELLOW:-}⚠ TRANSCRYPT_PASSWORD repo secret not found${ENDCOLOR:-}"
  fi

  local has_envcrypt=false
  if [ -f .envcrypt ] && [ -s .envcrypt ]; then
    has_envcrypt=true
  fi

  # Check if transcrypt is available
  if ! command -v transcrypt &>/dev/null; then
    echo -e "${YELLOW:-}⚠ transcrypt not installed. Install with: brew install transcrypt${ENDCOLOR:-}"
    echo "Skipping transcrypt bootstrap (transcrypt not available)"
    return 0
  fi

  # Case 1: encrypted file exists but no repo secret → stale, remove it
  if [ "$has_envcrypt" = true ] && [ "$has_secret" = false ]; then
    echo -e "${YELLOW:-}Encrypted file exists but no repo secret. Cleaning up stale .envcrypt...${ENDCOLOR:-}"
    # Flush transcrypt if configured
    transcrypt --flush-credentials 2>/dev/null || true
    git rm --cached .envcrypt 2>/dev/null || true
    > .envcrypt
    echo -e "${GREEN:-}✓ Cleaned stale .envcrypt${ENDCOLOR:-}"
    has_envcrypt=false
  fi

  # Case 2: no encrypted file, no secret → fresh bootstrap
  if [ "$has_envcrypt" = false ] && [ "$has_secret" = false ]; then
    echo "Bootstrapping new transcrypt configuration..."
    local password
    password=$(openssl rand -hex 32)

    transcrypt -c aes-256-cbc -p "$password" --yes 2>/dev/null || {
      echo -e "${YELLOW:-}transcrypt init failed, creating minimal config${ENDCOLOR:-}"
      touch .envcrypt
    }

    echo "$password" | gh secret set TRANSCRYPT_PASSWORD -R "$repo"
    echo -e "${GREEN:-}✓ Transcrypt bootstrapped and TRANSCRYPT_PASSWORD stored as repo secret${ENDCOLOR:-}"
    return 0
  fi

  # Case 3: secret exists → configure transcrypt using it
  if [ "$has_secret" = true ]; then
    echo "Configuring transcrypt from repo secret..."

    # Check if already configured
    if transcrypt --display 2>/dev/null | grep -q "cipher"; then
      echo -e "${GREEN:-}✓ Transcrypt already configured${ENDCOLOR:-}"
      return 0
    fi

    # In CI, the secret is available as env var; locally user must fetch it
    local password="${TRANSCRYPT_PASSWORD:-}"
    if [ -z "$password" ]; then
      echo -e "${YELLOW:-}TRANSCRYPT_PASSWORD not in environment.${ENDCOLOR:-}"
      echo "In CI, this is injected automatically."
      echo "Locally, ask a team member or check GitHub repo settings."
      return 0
    fi

    transcrypt -c aes-256-cbc -p "$password" --yes
    echo -e "${GREEN:-}✓ Transcrypt configured from repo secret${ENDCOLOR:-}"
    return 0
  fi

  # Case 4: Conjur fallback
  if [ -n "${CONJUR_API_KEY:-}" ]; then
    echo "Conjur API key detected. Attempting to retrieve transcrypt password from Conjur..."
    source ./scripts/resolve_secrets.sh 2>/dev/null || true
    local conjur_password
    conjur_password=$(resolve_single_secret "transcrypt/password" "conjur" 2>/dev/null || echo "")
    if [ -n "$conjur_password" ]; then
      transcrypt -c aes-256-cbc -p "$conjur_password" --yes
      echo -e "${GREEN:-}✓ Transcrypt configured from Conjur${ENDCOLOR:-}"
      return 0
    fi
  fi

  echo -e "${GREEN:-}✓ Transcrypt bootstrap complete${ENDCOLOR:-}"
}
