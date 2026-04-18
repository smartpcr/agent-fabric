import { useContext } from "react";
import { AnnouncerContext, type AnnouncerContextValue } from "@/providers/AnnouncerProvider";

/**
 * Returns `{ announce }` from the nearest `AnnouncerProvider`.
 *
 * @throws if used outside of an `AnnouncerProvider`.
 */
export function useAnnounce(): AnnouncerContextValue {
  const ctx = useContext(AnnouncerContext);
  if (ctx === null) {
    throw new Error("useAnnounce used outside of AnnouncerProvider");
  }
  return ctx;
}
