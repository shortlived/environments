/**
 * decr.py source template.
 *
 * The template is rendered by the Deno binary at acquiesce time with a
 * freshly-generated `super_secret` embedded as a hex literal. The result is
 * AES-256-GCM encrypted and written to /tmp/$dayhashB64/decr.py.
 *
 * The template is intentionally tiny. It exposes a single `super_secret_hex`
 * top-level constant. The Deno binary parses that constant from the decrypted
 * source at push time — no Python interpreter is required for ordinary use.
 *
 * The script also functions as a standalone offline decryption fallback: if
 * the Deno binary becomes unavailable but the operator can still derive
 * `decr_key` and `super_secret`, the dict.py file can be decrypted manually
 * via the bundled `decrypt_dict()` helper using libsodium's `secretbox`.
 */

export interface DecrTemplateInputs {
  superSecretHex: string;
  generatedAtIsoUtc: string;
}

export function renderDecrTemplate(inputs: DecrTemplateInputs): string {
  return `# kpsc decr.py — generated ${inputs.generatedAtIsoUtc}
# This file is encrypted at rest. If you can read this in plaintext,
# something has gone wrong with the cache pipeline.

super_secret_hex = "${inputs.superSecretHex}"


def decrypt_dict(encrypted_blob: bytes) -> dict:
    """Decrypt /tmp/$dayhashCBC/dict.py using AES-GCM with super_secret."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import json

    key = bytes.fromhex(super_secret_hex)
    nonce, ct = encrypted_blob[:12], encrypted_blob[12:]
    pt = AESGCM(key).decrypt(nonce, ct, None)
    return json.loads(pt.decode("utf-8"))
`;
}

/** Parse `super_secret_hex` out of a decr.py source body. */
export function extractSuperSecretHex(decrPySource: string): string {
  const match = decrPySource.match(/super_secret_hex\s*=\s*"([0-9a-fA-F]+)"/);
  if (!match) throw new Error("decr.py is malformed: super_secret_hex not found");
  return match[1];
}
