/**
 * Discriminated-union result type used across adapters and domain logic.
 *
 * Callers pattern-match on `ok`:
 *
 * ```ts
 * const r = await repo.get("id-1");
 * if (r.ok) { use(r.value); } else { handle(r.error); }
 * ```
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Convenience factory for a success result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Convenience factory for a failure result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
