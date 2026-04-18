import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function FallbackUi({ onRecover }: { onRecover: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" style={{ padding: "24px", textAlign: "center" }}>
      <h2>{t("errorBoundary.title")}</h2>
      <p>{t("errorBoundary.description")}</p>
      <button type="button" onClick={onRecover}>
        {t("errorBoundary.recover")}
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
