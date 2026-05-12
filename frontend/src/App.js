import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

// Restore a pending call encoded in URL params (from Telegram notification deep link)
const PendingCallRestorer = () => {
  const { user, loading } = useAuth();
  const { setIncomingCall, incomingCall, activeCall } = useCall();

  useEffect(() => {
    // Save call params to localStorage before auth redirects away
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'incoming-call') {
      localStorage.setItem('pendingCallParams', window.location.search);
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    // Check URL first, then fall back to localStorage
    let search = window.location.search;
    const stored = localStorage.getItem('pendingCallParams');
    if (new URLSearchParams(search).get('action') !== 'incoming-call' && stored) {
      search = stored;
    }
    localStorage.removeItem('pendingCallParams');

    const params = new URLSearchParams(search);
    if (params.get('action') !== 'incoming-call') return;
    if (incomingCall || activeCall) return;

    const callerId   = params.get('callerId');
    const callerName = params.get('callerName') || 'Friend';
    const callerAvatar = params.get('callerAvatar') || '';
    const callType   = params.get('callType') === 'video' ? 'video' : 'voice';

    setIncomingCall({
      from: { _id: callerId || 'unknown', name: callerName, avatar: callerAvatar },
      callType
    });

    // Clean up URL params without reloading
    const url = new URL(window.location.href);
    ['action', 'callerId', 'callerName', 'callerAvatar', 'callType'].forEach(k => url.searchParams.delete(k));
    window.history.replaceState({}, '', url.toString());
  }, [loading, user, setIncomingCall, incomingCall, activeCall]);

  return null;
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
      <PendingCallRestorer />
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

const App = () => {
  React.useEffect(() => {
    console.log('[App] Initialized');
    console.log('[App] Backend URL:', process.env.REACT_APP_BACKEND_URL || 'https://pastel-chat.onrender.com');
    console.log('[App] Environment:', process.env.NODE_ENV);
  }, []);

  return (
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
  );
};

export default App;
