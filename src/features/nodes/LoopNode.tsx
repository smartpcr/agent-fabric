import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface LoopData {
  readonly condition?: string;
  readonly iterable?: string;
  readonly item?: string;
  readonly iterationCount?: number;
}

const MAX_PREVIEW_LENGTH = 24;

function truncatePreview(text: string): string {
  if (text.length <= MAX_PREVIEW_LENGTH) return text;
  return `${text.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
}

const BADGE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "-10px",
  right: "-10px",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "#6366f1",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: "none",
  zIndex: 1,
};

const HANDLE_LABEL_STYLE: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 600,
  color: "#6b7280",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  position: "absolute",
};

export function LoopNode({ id, data, type, selected }: NodeProps) {
  const loopData = data as LoopData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "loop-while"));
  const openInspector = useWorkflowStore((s) => s.openInspector);
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const icon = spec?.icon ?? "repeat";
  const label = spec?.label ?? "Loop";

  const inPort = spec?.ports.find((p) => p.kind === "in" && p.id === "in");
  const bodyOutPort = spec?.ports.find((p) => p.kind === "out" && p.id === "body-out");
  const bodyInPort = spec?.ports.find((p) => p.kind === "in" && p.id === "body-in");
  const donePort = spec?.ports.find((p) => p.kind === "out" && p.id === "done");
  const breakPort = spec?.ports.find((p) => p.kind === "out" && p.id === "break");

  // Build condition/iterable preview
  let preview = "—";
  if (loopData.condition) {
    preview = truncatePreview(loopData.condition);
  } else if (loopData.iterable) {
    const itemLabel = loopData.item ? `${loopData.item} in ` : "";
    preview = truncatePreview(`${itemLabel}${loopData.iterable}`);
  }

  return (
    <div
      style={{ position: "relative", width: "180px", minHeight: "100px" }}
      data-testid="loop-node-wrapper"
    >
      {/* ↻ badge */}
      <div data-testid="loop-badge" style={BADGE_STYLE} aria-label="loop indicator">
        ↻
      </div>

      <BaseNode
        title={label}
        icon={icon}
        selected={selected}
        nodeId={id}
        borderRadius="12px"
        onEnter={() => {
          openInspector(id);
        }}
        onNodeFocus={() => {
          selectNode(id, "replace");
        }}
        onDelete={deleteSelected}
      >
        {/* Condition/iterable preview */}
        <div
          data-testid="loop-preview"
          style={{
            fontSize: "11px",
            color: "#4338ca",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "150px",
            margin: "0 auto",
          }}
        >
          {preview}
        </div>

        {/* Iteration counter slot — populated by Phase 6 */}
        <div
          data-testid="loop-iteration-counter"
          style={{
            fontSize: "10px",
            color: "#9ca3af",
            textAlign: "center",
            marginTop: "4px",
            minHeight: "14px",
          }}
        >
          {loopData.iterationCount === undefined
            ? ""
            : `iteration ${String(loopData.iterationCount)}`}
        </div>
      </BaseNode>

      {/* Input handle on left */}
      {inPort ? (
        <InputHandle
          portSpec={inPort}
          position={Position.Left}
          nodeId={id}
          data-testid="loop-handle-in"
        />
      ) : null}

      {/* Body Out handle on right */}
      {bodyOutPort ? (
        <>
          <OutputHandle
            portSpec={bodyOutPort}
            position={Position.Right}
            nodeId={id}
            data-testid="loop-handle-body-out"
          />
          <span
            data-testid="loop-label-body-out"
            style={{
              ...HANDLE_LABEL_STYLE,
              right: "-8px",
              top: "35%",
              transform: "translate(100%, -50%)",
            }}
          >
            body
          </span>
        </>
      ) : null}

      {/* Body In handle on left (below main input) */}
      {bodyInPort ? (
        <>
          <InputHandle
            portSpec={bodyInPort}
            position={Position.Left}
            nodeId={id}
            data-testid="loop-handle-body-in"
          />
          <span
            data-testid="loop-label-body-in"
            style={{
              ...HANDLE_LABEL_STYLE,
              left: "-8px",
              top: "70%",
              transform: "translate(-100%, -50%)",
            }}
          >
            back
          </span>
        </>
      ) : null}

      {/* Done handle on bottom */}
      {donePort ? (
        <>
          <OutputHandle
            portSpec={donePort}
            position={Position.Bottom}
            nodeId={id}
            data-testid="loop-handle-done"
          />
          <span
            data-testid="loop-label-done"
            style={{
              ...HANDLE_LABEL_STYLE,
              bottom: "-8px",
              left: "50%",
              transform: "translate(-50%, 100%)",
            }}
          >
            done
          </span>
        </>
      ) : null}

      {/* Break handle on bottom-right (for-each only) */}
      {breakPort ? (
        <>
          <OutputHandle
            portSpec={breakPort}
            position={Position.Bottom}
            nodeId={id}
            data-testid="loop-handle-break"
          />
          <span
            data-testid="loop-label-break"
            style={{
              ...HANDLE_LABEL_STYLE,
              bottom: "-8px",
              right: "10%",
              transform: "translateY(100%)",
            }}
          >
            break
          </span>
        </>
      ) : null}
    </div>
  );
}
