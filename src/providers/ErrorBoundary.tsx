import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function FallbackUi({ onRecover }: { onRecover: () => void }) {
  return (
    <div role="alert" style={{ padding: "24px", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>An unexpected error occurred.</p>
      <button type="button" onClick={onRecover}>
        Recover
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <FallbackUi onRecover={this.handleRecover} />;
    }
    return this.props.children;
  }
}
