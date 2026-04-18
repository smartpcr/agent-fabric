import { useWorkflowStore } from "@/store/hooks";
import { selectEdgeExecutionState } from "@/store/selectors/executionSelectors";
import type { EdgeExecutionState } from "@/store/slices/executionSlice";

/**
 * Hook that subscribes to the execution state of a specific edge within the
 * active run. Returns `undefined` when there is no active run or the edge
 * has no execution state yet.
 *
 * Uses the memoized `selectEdgeExecutionState` selector so the returned
 * reference is stable across unrelated store updates (preventing unnecessary
 * re-renders).
 *
 * Cleanup happens automatically when the component unmounts — zustand
 * unsubscribes the selector listener.
 */
export function useEdgeExecutionState(edgeId: string): EdgeExecutionState | undefined {
  return useWorkflowStore((state) => {
    const { activeRunId } = state;
    if (activeRunId === undefined) {
      return undefined;
    }
    return selectEdgeExecutionState(state, activeRunId, edgeId);
  });
}
