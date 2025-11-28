'use client';

import React from 'react';

interface OrdersErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class OrdersErrorBoundary extends React.Component<
  { children: React.ReactNode },
  OrdersErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): OrdersErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Orders page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass-thick rounded-2xl p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error al cargar la página</h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'Ocurrió un error inesperado'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="glass-interactive px-4 py-2 rounded-xl font-semibold bg-systemBlue text-white"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
