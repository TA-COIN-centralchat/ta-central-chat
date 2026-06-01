import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#fbfbfd] px-4 py-10">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#e8edf2] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <div className="border-b border-[#edf1f5] px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
                  <AlertTriangle size={22} />
                </div>

                <div>
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                    Application Error
                  </h1>

                  <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                    The app hit a runtime error while rendering this page. You
                    can reload the page, or check the error details below during
                    development.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-[22px] border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                Something went wrong in the UI. This usually happens because a
                component received missing data, an import failed, or a runtime
                error occurred during rendering.
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-[#e8edf2] bg-[#0f172a]">
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    Error Details
                  </div>
                </div>

                <pre className="max-h-90 overflow-auto p-4 text-xs leading-6 text-slate-100">
                  {this.state.error?.stack ||
                    this.state.error?.message ||
                    'Unknown error'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#edf1f5] bg-[#fbfbfd] px-6 py-4">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:bg-[#2389b8]"
              >
                <RefreshCw size={16} />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;