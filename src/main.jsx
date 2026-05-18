import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('WebGIS runtime error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#38bdf8', fontSize: 22, marginBottom: 12 }}>WebGIS startup error</h1>
          <p style={{ color: '#cbd5e1', marginBottom: 12 }}>The app caught a runtime error instead of showing a black screen.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,.08)', padding: 16, borderRadius: 16, color: '#fecaca' }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
          <button
            onClick={() => {
              localStorage.clear()
              location.reload()
            }}
            style={{ marginTop: 16, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(56,189,248,.5)', background: 'rgba(56,189,248,.15)', color: '#e0f2fe', fontWeight: 700 }}
          >
            Cancella dati locali e ricarica
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
