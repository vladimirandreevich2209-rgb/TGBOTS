import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0e1621] text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#17212b] p-6 rounded-2xl border border-[#2b3a4a] space-y-4">
            <h2 className="text-lg font-bold text-red-400">Произошла ошибка при загрузке</h2>
            <p className="text-xs text-[#708499] break-words">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-[#3390ec] hover:bg-[#2b83d8] rounded-xl text-white text-sm font-semibold transition"
            >
              Перезагрузить приложение
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
