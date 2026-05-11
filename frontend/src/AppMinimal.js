import React from 'react';

export default function AppMinimal() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#FFF0F5', minHeight: '100vh' }}>
      <h1>Pastel Chat - iOS App</h1>
      <p>React is working! ✓</p>
      <div style={{ padding: '10px', backgroundColor: 'white', marginTop: '20px', borderRadius: '5px' }}>
        <p><strong>Status:</strong> React successfully initialized in iOS WebView</p>
        <p><strong>Capacitor:</strong> {window.Capacitor ? '✓ Available' : '✗ Not available'}</p>
        <p><strong>Platform:</strong> iOS</p>
      </div>
    </div>
  );
}
