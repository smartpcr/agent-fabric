import { useContext } from "react";
import { WorkflowRepoContext } from "@/providers/RepositoryProvider";

export function useWorkflowRepo() {
  const ctx = useContext(WorkflowRepoContext);
  if (ctx === null) {
    throw new Error("useWorkflowRepo used outside of provider");
  }
  return ctx;
}
