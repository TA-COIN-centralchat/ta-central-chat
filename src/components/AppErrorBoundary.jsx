import { Component } from "react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled UI error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8">
            <h1 className="text-xl font-semibold text-red-700">
              Application Error
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              The app hit a runtime error while rendering this page.
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {this.state.error?.stack ||
                this.state.error?.message ||
                "Unknown error"}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
