import { useWorkflowStore } from "@/store/hooks";
import { selectNodeExecutionState } from "@/store/selectors/executionSelectors";
import type { NodeExecutionState } from "@/store/slices/executionSlice";

/**
 * Hook that subscribes to the execution state of a specific node within the
 * active run. Returns `undefined` when there is no active run or the node
 * has no execution state yet.
 *
 * Uses the memoized `selectNodeExecutionState` selector so the returned
 * reference is stable across unrelated store updates (preventing unnecessary
 * re-renders).
 *
 * Cleanup happens automatically when the component unmounts — zustand
 * unsubscribes the selector listener.
 */
export function useExecutionState(nodeId: string): NodeExecutionState | undefined {
  return useWorkflowStore((state) => {
    const { activeRunId } = state;
    if (activeRunId === undefined) {
      return undefined;
    }
    return selectNodeExecutionState(state, activeRunId, nodeId);
  });
}
