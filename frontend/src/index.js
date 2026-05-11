import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';

// Apply saved theme before first render to avoid flash
if (localStorage.getItem('pastelchat.theme') === 'dark') {
  document.body.classList.add('dark');
}
import { register as registerSW } from './serviceWorkerRegistration';
import App from './App';

const ErrorBoundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#FFF0F5', minHeight: '100vh' }}>
          <h1>Error Loading App</h1>
          <p style={{ color: 'red' }}>{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', backgroundColor: '#FFB6C1', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

registerSW({
  onSuccess: () => console.log('Pastel Chat is ready to work offline.'),
  onUpdate: (reg) => {
    const worker = reg.waiting;
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  },
});
