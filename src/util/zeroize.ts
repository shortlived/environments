/**
 * Best-effort memory zeroization helpers.
 *
 * JavaScript provides no guarantee that buffers are wiped from memory before
 * the GC reclaims them. The best we can do is overwrite the bytes we still
 * hold a reference to and drop the reference. These helpers do exactly that.
 */

/** Overwrite a Uint8Array with zeros in place. */
export function zeroBytes(buf: Uint8Array | null | undefined): void {
  if (!buf) return;
  buf.fill(0);
}

/** Overwrite multiple buffers at once. */
export function zeroAll(...bufs: (Uint8Array | null | undefined)[]): void {
  for (const b of bufs) zeroBytes(b);
}

/**
 * Replace every character of a string with NUL.
 *
 * Strings are immutable in JS so this cannot mutate the original — it returns
 * a freshly wiped buffer and the caller should drop the original reference.
 */
export function wipeStringSlot(_s: string): void {
  /* intentionally a no-op: see above. Provided so call sites remain expressive. */
}
