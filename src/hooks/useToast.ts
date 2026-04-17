import { useContext } from "react";
import { ToastContext } from "@/features/editor/Toast";

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast used outside of ToastProvider");
  }
  return ctx;
}
