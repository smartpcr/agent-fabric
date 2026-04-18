import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface DragPayload {
  readonly kind: string;
}

export interface DragState {
  readonly isDragging: boolean;
  readonly payload: DragPayload | null;
}

interface DragContextValue {
  readonly state: DragState;
  readonly startDrag: (payload: DragPayload) => void;
  readonly endDrag: () => void;
}

const IDLE_STATE: DragState = { isDragging: false, payload: null };

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<DragState>(IDLE_STATE);

  const startDrag = useCallback((payload: DragPayload) => {
    setState({ isDragging: true, payload });
  }, []);

  const endDrag = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  // Global cleanup: any pointer release or cancel while dragging clears state.
  // Canvas's own onPointerUp adds a node before this fires; releases
  // outside the canvas simply clear the drag without adding anything.
  useEffect(() => {
    if (!state.isDragging) return;

    const onGlobalPointerUp = () => {
      endDrag();
    };

    window.addEventListener("pointerup", onGlobalPointerUp);
    window.addEventListener("pointercancel", onGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", onGlobalPointerUp);
      window.removeEventListener("pointercancel", onGlobalPointerUp);
    };
  }, [state.isDragging, endDrag]);

  const value = useMemo(() => ({ state, startDrag, endDrag }), [state, startDrag, endDrag]);

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) {
    throw new Error("useDragContext must be used within a DragProvider");
  }
  return ctx;
}
