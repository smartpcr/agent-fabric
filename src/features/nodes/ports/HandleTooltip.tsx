import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { PortSpec } from "@/domain/models/port";

export interface HandleTooltipProps {
  readonly portSpec: PortSpec;
  readonly children: ReactNode;
}

function formatTooltipContent(portSpec: PortSpec): string {
  return `${portSpec.label} · ${portSpec.dataType} · ${portSpec.cardinality}`;
}

export function HandleTooltip({ portSpec, children }: HandleTooltipProps) {
  const content = formatTooltipContent(portSpec);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal container={document.getElementById("portal-root") ?? undefined}>
          <Tooltip.Content side="top" sideOffset={6}>
            {content}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export { formatTooltipContent };
