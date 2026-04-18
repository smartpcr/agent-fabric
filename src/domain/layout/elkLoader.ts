import type { ELK } from "elkjs/lib/elk-api";

let cachedInstance: ELK | null = null;
let pendingLoad: Promise<ELK> | null = null;

/**
 * Lazy-load the ELK (Eclipse Layout Kernel) WASM module exactly once.
 *
 * The first call triggers a dynamic `import("elkjs/lib/elk.bundled.js")` and
 * caches the resulting ELK instance. Subsequent calls return the cached
 * singleton immediately. Concurrent callers share the same in-flight promise
 * so only one module load ever happens.
 */
export async function getElk(): Promise<ELK> {
  if (cachedInstance) return cachedInstance;

  if (!pendingLoad) {
    pendingLoad = (async () => {
      const { default: ElkConstructor } = await import("elkjs/lib/elk.bundled.js");
      const instance = new ElkConstructor();
      cachedInstance = instance;
      pendingLoad = null;
      return instance;
    })();
  }

  return pendingLoad;
}

/** Visible for testing — resets the cached ELK singleton. */
export function resetElkLoader(): void {
  cachedInstance = null;
  pendingLoad = null;
}
