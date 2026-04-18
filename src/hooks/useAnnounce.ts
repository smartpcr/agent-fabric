import { useContext } from "react";
import { AnnouncerContext, type AnnouncerContextValue } from "@/providers/AnnouncerProvider";

/** No-op fallback for when the hook is used outside AnnouncerProvider. */
const NOOP_ANNOUNCER: AnnouncerContextValue = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  announce: () => {},
};

/**
 * Returns `{ announce }` from the nearest `AnnouncerProvider`.
 *
 * When used outside of an `AnnouncerProvider`, returns a no-op so
 * components that announce are safe to render without the provider
 * (e.g. in unit tests that don't mount the full app tree).
 */
export function useAnnounce(): AnnouncerContextValue {
  const ctx = useContext(AnnouncerContext);
  return ctx ?? NOOP_ANNOUNCER;
}
