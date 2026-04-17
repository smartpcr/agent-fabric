import { createContext, useContext } from "react";

export type StartKeyboardConnect = (nodeId: string, portId: string) => void;

export const KeyboardConnectContext = createContext<StartKeyboardConnect | null>(null);

export function useStartKeyboardConnect(): StartKeyboardConnect | null {
  return useContext(KeyboardConnectContext);
}
