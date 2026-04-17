import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import Privacy from './pages/Privacy';
import LoadingAnimation from './components/LoadingAnimation';
import Signature from './components/Signature';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#FFF8F3'
      }}>
        <LoadingAnimation label="" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
};

const PageFrame = ({ children }) => (
  <div className="page-frame page-fade-in">{children}</div>
);

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/home" replace /> : <PageFrame><Login /></PageFrame>}
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <PageFrame><Home /></PageFrame>
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <PageFrame><Profile /></PageFrame>
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <PageFrame><Friends /></PageFrame>
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:friendId"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <Chat />
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <PageFrame><Privacy /></PageFrame>
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Signature />
    </>
  );
};

const App = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;
