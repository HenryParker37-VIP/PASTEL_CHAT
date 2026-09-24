import { realtimeEndpoint, reconciliationDelay } from './realtimePolicy';

test('an explicit Render relay never changes the REST endpoint', () => {
  expect(realtimeEndpoint({ relayUrl: 'https://relay.onrender.com', backendUrl: 'https://pastel-chat.vercel.app', origin: 'https://pastel-chat.vercel.app' }))
    .toBe('https://relay.onrender.com');
  expect(realtimeEndpoint({ signalingUrl: 'https://relay.onrender.com', origin: 'https://pastel-chat.vercel.app' }))
    .toBe('https://pastel-chat.vercel.app');
});

test('Render sleep and disconnect activate fast Vercel reconciliation', () => {
  expect(reconciliationDelay({ relayMode: true, connected: false, visible: true })).toBe(1500);
  expect(reconciliationDelay({ relayMode: true, connected: true, visible: true })).toBe(15000);
  expect(reconciliationDelay({ relayMode: true, connected: false, visible: false })).toBe(15000);
  expect(reconciliationDelay({ relayMode: false, connected: true, visible: true })).toBe(1500);
});
