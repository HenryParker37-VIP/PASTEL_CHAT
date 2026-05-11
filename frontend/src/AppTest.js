import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const LoginTest = () => (
  <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#FFF0F5', minHeight: '100vh' }}>
    <h1>Pastel Chat - Login</h1>
    <p>React Router is working! ✓</p>
    <button style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', backgroundColor: '#FFB6C1', cursor: 'pointer', fontSize: '16px' }}>
      Login
    </button>
  </div>
);

const HomeTest = () => (
  <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#FFF0F5', minHeight: '100vh' }}>
    <h1>Pastel Chat - Home</h1>
    <p>Home page loaded! ✓</p>
  </div>
);

export default function AppTest() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginTest />} />
        <Route path="/home" element={<HomeTest />} />
      </Routes>
    </Router>
  );
}
