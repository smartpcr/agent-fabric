import type { NodeSpec } from "@/domain/models/nodeSpec";
import { UnknownNodeKindError } from "@/domain/validation/errors";

export class NodeRegistry {
  private readonly specs = new Map<string, NodeSpec>();

  private frozen = false;

  register(spec: NodeSpec): void {
    if (this.frozen) {
      throw new Error(`Registry is frozen — cannot register kind "${spec.kind}"`);
    }

    if (this.specs.has(spec.kind)) {
      throw new Error(`Duplicate node kind: "${spec.kind}" is already registered`);
    }

    this.specs.set(spec.kind, spec);
  }

  resolve(kind: string): NodeSpec {
    const spec = this.specs.get(kind);
    if (!spec) {
      throw new UnknownNodeKindError(kind);
    }
    return spec;
  }

  has(kind: string): boolean {
    return this.specs.has(kind);
  }

  list(): readonly NodeSpec[] {
    return [...this.specs.values()];
  }

  freeze(): void {
    this.frozen = true;
  }
}
