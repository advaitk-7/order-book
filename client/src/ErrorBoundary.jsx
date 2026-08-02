import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL APP RENDER ERROR CAUGHT BY BOUNDARY:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    localStorage.clear()
    sessionStorage.clear()
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#F8FAFC',
          color: '#0F172A',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0', color: '#0F172A' }}>
              Application Error Intercepted
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              The exact error detail below was captured:
            </p>

            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'left',
              fontFamily: 'monospace',
              marginBottom: '20px',
              maxHeight: '200px',
              overflowY: 'auto',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              <strong>Error:</strong> {this.state.error?.toString() || 'Unknown Render Error'}
              {this.state.errorInfo?.componentStack && (
                <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.8 }}>
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Try Re-rendering
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Clear Cache & Hard Reset
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
