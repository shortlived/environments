/**
 * Cache directory layout helpers.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { CACHE_ROOT } from "../constants/config.ts";

export interface CachePaths {
  decrDir: string;
  decrFile: string;
  dictDir: string;
  dictFile: string;
}

export function cachePaths(
  dayhashB64: string,
  dayhashCBC: string,
  root: string = CACHE_ROOT,
): CachePaths {
  const decrDir = join(root, dayhashB64);
  const dictDir = join(root, dayhashCBC);
  return {
    decrDir,
    decrFile: join(decrDir, "decr.py"),
    dictDir,
    dictFile: join(dictDir, "dict.py"),
  };
}

/** Create both cache directories with mode 0700. */
export async function prepareCacheDirs(p: CachePaths): Promise<void> {
  for (const dir of [p.decrDir, p.dictDir]) {
    await ensureDir(dir);
    try {
      await Deno.chmod(dir, 0o700);
    } catch { /* non-POSIX: skip */ }
  }
}
