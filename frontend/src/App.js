import React, { useEffect, useState, useCallback } from 'react';
import { useMobileViewport } from './hooks/useMobileViewport';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initMsal } from './services/microsoft-auth';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { CallProvider, useCall } from './contexts/CallContext';
import { ToastProvider, useToast } from './components/Toast';
import { LangProvider } from './i18n';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import GroupChat from './pages/GroupChat';
import PrivateSpace from './pages/PrivateSpace';
import SharedPhotos from './pages/SharedPhotos';
import InstallGuide from './pages/InstallGuide';
import Privacy from './pages/Privacy';
import Admin from './pages/Admin';
import LoadingAnimation from './components/LoadingAnimation';
import Signature from './components/Signature';
import IncomingCallAlert from './components/IncomingCallAlert';
import VoiceCallScreen from './components/VoiceCallScreen';
import VideoCallScreen from './components/VideoCallScreen';
import HappyBirthdayOverlay from './components/HappyBirthdayOverlay';
import GlobalChecker from './components/GlobalChecker';

// Minimal component rendered inside a Microsoft OAuth popup window.
// Calling initMsal() triggers MSAL's popup-response handler, which posts the
// auth result back to the parent window and then closes this popup.
// Nothing else (AuthProvider, Router, session restoration) should run here.
const MsalPopupHandler = () => {
  const [error, setError] = useState(null);

  useEffect(() => {
    let closed = false;
    initMsal()
      .then(() => {
        // MSAL closes the window automatically on success.
        // If the window is still open after 5 s, something went wrong.
        setTimeout(() => {
          if (!closed) setError(true);
        }, 5000);
      })
      .catch(() => { if (!closed) setError(true); });
    return () => { closed = true; };
  }, []);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div>Sign-in failed. Please close this window and try again.</div>
        <button onClick={() => window.close()} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 20, border: '1px solid #ddd', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontSize: 50, marginBottom: 20 }}>🌸</div>
      <div style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>Signing in...</div>
      <div style={{ width: 40, height: 40, border: '4px solid #DDD', borderTop: '4px solid #DDA0DD', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const GlobalSocketListener = ({ onHappyBirthday }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (payload) => {
      if (payload.type === 'friend_requested') {
        push({ emoji: '📫', title: 'New friend request!', body: `${payload.from?.name} wants to be friends.` });
      }
      if (payload.type === 'friend_accepted') {
        push({ emoji: '🌸', title: 'Request accepted!', body: `You are now friends with ${payload.from?.name}.` });
      }
      if (payload.type === 'new_message') {
        push({ emoji: '💬', title: `New message from ${payload.from?.name}`, body: payload.preview });
      }
      if (payload.type === 'group_message') {
        push({
          emoji: '👥', title: `${payload.groupName}`,
          body: `${payload.from?.name}: ${payload.preview}`,
          onClick: () => navigate(`/group/${payload.groupId}`)
        });
      }
      if (payload.type === 'group_created' || payload.type === 'group_invited') {
        push({ emoji: '👥', title: `Added to "${payload.group?.name}"`, body: `by ${payload.from?.name}` });
      }
      if (payload.type === 'happy_birthday') {
        onHappyBirthday({ friendName: user.name, age: payload.age, isOwn: true });
      }
    };
    socket.on(`notify:${user._id}`, handler);
    return () => socket.off(`notify:${user._id}`, handler);
  }, [socket, user, push, navigate, onHappyBirthday]);

  return null;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FFF8F3' }}>
        <LoadingAnimation label="" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
};

const PageFrame = ({ children }) => (
  <div className="page-frame page-fade-in">{children}</div>
);

const CallOverlays = () => {
  const { incomingCall, activeCall } = useCall();
  return (
    <>
      {incomingCall && <IncomingCallAlert />}
      {activeCall?.callType === 'voice' && <VoiceCallScreen />}
      {activeCall?.callType === 'video' && <VideoCallScreen />}
    </>
  );
};

const AppRoutes = () => {
  const { user } = useAuth();
  const [birthdayOverlay, setBirthdayOverlay] = useState(null);

  const handleBirthdayToday = useCallback(({ friendId, friendName, age }) => {
    setBirthdayOverlay({ friendName, age, isOwn: false });
  }, []);

  const handleHappyBirthday = useCallback(({ friendName, age, isOwn }) => {
    setBirthdayOverlay({ friendName, age, isOwn });
  }, []);

  return (
    <>
      {user && <GlobalSocketListener onHappyBirthday={handleHappyBirthday} />}
      {user && <CallOverlays />}
      {user && <GlobalChecker onBirthdayToday={handleBirthdayToday} />}
      {birthdayOverlay && (
        <HappyBirthdayOverlay
          name={birthdayOverlay.friendName}
          age={birthdayOverlay.age}
          isOwn={birthdayOverlay.isOwn}
          onClose={() => setBirthdayOverlay(null)}
        />
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <PageFrame><Login /></PageFrame>} />
        <Route path="/home" element={<ProtectedRoute><PageFrame><Home /></PageFrame></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PageFrame><Profile /></PageFrame></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><PageFrame><Friends /></PageFrame></ProtectedRoute>} />
        <Route path="/chat/:friendId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/group/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
        <Route path="/my-space" element={<ProtectedRoute><PageFrame><PrivateSpace /></PageFrame></ProtectedRoute>} />
        <Route path="/shared-photos" element={<ProtectedRoute><SharedPhotos /></ProtectedRoute>} />
        <Route path="/install" element={<ProtectedRoute><PageFrame><InstallGuide /></PageFrame></ProtectedRoute>} />
        <Route path="/privacy" element={<ProtectedRoute><PageFrame><Privacy /></PageFrame></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><PageFrame><Admin /></PageFrame></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Signature />
    </>
  );
};

// Detect an OAuth popup callback reliably at module load time.
//
// window.opener can be null even in a real popup because some browsers null it
// out after a cross-origin navigation (popup goes through login.microsoft.com
// then redirects back). We therefore use two independent signals:
//
//  1. window.opener !== null  — classic popup signal
//  2. OAuth params in URL     — Microsoft ALWAYS appends ?code=&state= to the
//                               redirect URI; normal app loads never have these
//
// We exclude iOS / PWA standalone because those use loginRedirect (not popup)
// and the returning page also has auth params — AuthContext handles those.
const _urlSearch = new URLSearchParams(window.location.search);
const _hasOAuthParams = _urlSearch.has('code') && _urlSearch.has('state');
const _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const _isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

const IS_OAUTH_POPUP =
  window.opener !== null ||
  (_hasOAuthParams && !_isIOS && !_isStandalone);

const App = () => {
  useMobileViewport(); // tracks keyboard height → --keyboard-height CSS var

  React.useEffect(() => {
    if (!IS_OAUTH_POPUP) {
      console.log('[App] Initialized');
      console.log('[App] Backend URL:', process.env.REACT_APP_BACKEND_URL || 'https://pastel-chat.onrender.com');
      console.log('[App] Environment:', process.env.NODE_ENV);
    }
  }, []);

  // If this window was opened as an OAuth popup (window.opener is set), render
  // ONLY the MSAL popup handler. Rendering the full app here would restore the
  // existing localStorage session and navigate to /home, preventing MSAL from
  // completing the auth handshake and closing the popup.
  if (IS_OAUTH_POPUP) {
    return <MsalPopupHandler />;
  }

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <ToastProvider>
            <SocketProvider>
              <CallProvider>
                <Router>
                  <AppRoutes />
                </Router>
              </CallProvider>
            </SocketProvider>
          </ToastProvider>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
