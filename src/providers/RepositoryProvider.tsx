import { createContext, type ReactNode } from "react";
import type { IWorkflowRepository } from "@/ports/IWorkflowRepository";

export const WorkflowRepoContext = createContext<IWorkflowRepository | null>(null);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: IWorkflowRepository;
  children: ReactNode;
}) {
  return <WorkflowRepoContext.Provider value={repository}>{children}</WorkflowRepoContext.Provider>;
}
