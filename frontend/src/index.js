import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';

// Apply saved theme before first render to avoid flash
if (localStorage.getItem('pastelchat.theme') === 'dark') {
  document.body.classList.add('dark');
}
import { register as registerSW } from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
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
