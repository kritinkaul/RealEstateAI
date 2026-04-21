import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="shell centered-state">
          <h1>Something broke in the UI</h1>
          <p style={{ maxWidth: 520, lineHeight: 1.55 }}>
            {String(this.state.error.message || this.state.error)}
          </p>
          <button
            type="button"
            className="primary-button"
            style={{ marginTop: 8 }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
