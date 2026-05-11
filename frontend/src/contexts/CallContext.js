import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const buildIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
  const turnUrl  = process.env.REACT_APP_TURN_URL;
  const turnUser = process.env.REACT_APP_TURN_USERNAME;
  const turnCred = process.env.REACT_APP_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  } else {
    servers.push(
      { urls: 'turn:openrelay.metered.ca:80',                 username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',                username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turns:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }
  return servers;
};

const ICE_CONFIG = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user }   = useAuth();

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall,   setActiveCall]   = useState(null);
  const [isPiP,        setIsPiP]        = useState(false);

  const pcRef              = useRef(null);
  const localStreamRef     = useRef(null);
  const remoteStreamRef    = useRef(null);
  const localVideoRef      = useRef(null);
  const remoteVideoRef     = useRef(null);
  const remoteAudioRef     = useRef(null);

  const activeCallRef      = useRef(null);
  const incomingCallRef    = useRef(null);
  const pendingOfferRef    = useRef(null);
  const pendingIceRef      = useRef([]);
  const disconnectTimerRef = useRef(null);

  useEffect(() => { activeCallRef.current   = activeCall;  }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getAudioEl = useCallback(() =>
    remoteAudioRef.current || remoteVideoRef.current, []);

  // Resume audio element — called after backgrounding or PiP exit
  const resumeAudio = useCallback(() => {
    const el = getAudioEl();
    if (el && el.srcObject && el.paused) {
      el.play().catch(() => {});
    }
  }, [getAudioEl]);

  const getMedia = useCallback(async (callType) => {
    const constraints = callType === 'video'
      ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { video: false, audio: true };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        throw new Error('Camera/microphone permission denied. Please allow access and try again.');
      if (err.name === 'NotFoundError')
        throw new Error('No camera or microphone found on this device.');
      throw err;
    }
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current  = null;
    remoteStreamRef.current = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const flushPendingCandidates = useCallback(async (pc) => {
    const buffered = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of buffered) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }, []);

  // ── Speaker routing ──────────────────────────────────────────────────────────
  // Default: loudspeaker ON (isSpeaker:true), matching how real phone calls behave.
  // setSinkId('') = system default output = loudspeaker.
  // setSinkId('communications') = earpiece/handset route (Android/Desktop Chrome).
  // iOS Safari: setSinkId not supported; audio always plays on loudspeaker.

  const applySpeaker = useCallback(async (speakerOn) => {
    const el = getAudioEl();
    if (!el || typeof el.setSinkId !== 'function') return; // iOS — graceful no-op
    try {
      if (speakerOn) {
        await el.setSinkId(''); // default = loudspeaker
      } else {
        // Try to find earpiece device; fall back to 'communications' pseudo-id
        const devices = await navigator.mediaDevices.enumerateDevices();
        const earpiece = devices.find(d =>
          d.kind === 'audiooutput' &&
          (d.label.toLowerCase().includes('ear') ||
           d.label.toLowerCase().includes('receiver') ||
           d.deviceId === 'communications')
        );
        await el.setSinkId(earpiece?.deviceId || 'communications');
      }
    } catch (e) {
      console.warn('[Speaker]', e.message);
    }
  }, [getAudioEl]);

  // ── PiP ─────────────────────────────────────────────────────────────────────

  const enterPiP = useCallback(async () => {
    const vid = remoteVideoRef.current;
    if (!vid || !document.pictureInPictureEnabled) return;
    try {
      await vid.requestPictureInPicture();
      setIsPiP(true);
    } catch (e) {
      console.warn('[PiP]', e.message);
    }
  }, []);

  const exitPiP = useCallback(async () => {
    if (document.pictureInPictureElement) {
      try { await document.exitPictureInPicture(); } catch {}
    }
    setIsPiP(false);
  }, []);

  // Track PiP exit triggered from the browser pip window itself
  useEffect(() => {
    const vid = remoteVideoRef.current;
    if (!vid) return;
    const onLeavePiP = () => { setIsPiP(false); resumeAudio(); };
    vid.addEventListener('leavepictureinpicture', onLeavePiP);
    return () => vid.removeEventListener('leavepictureinpicture', onLeavePiP);
  });

  // ── Background / visibility handling ─────────────────────────────────────────
  // When backgrounded: auto-enter PiP for video, keep audio alive.
  // When foregrounded: resume audio element if it paused.

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (activeCallRef.current?.callType === 'video') {
          enterPiP();
        }
      } else {
        // Coming back to foreground — iOS may have paused the audio element
        resumeAudio();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enterPiP, resumeAudio]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanupCall = useCallback(() => {
    clearTimeout(disconnectTimerRef.current);
    exitPiP();
    pcRef.current?.close();
    pcRef.current       = null;
    pendingOfferRef.current = null;
    pendingIceRef.current   = [];
    stopMedia();
    setActiveCall(null);
    setIncomingCall(null);
    setIsPiP(false);
  }, [stopMedia, exitPiP]);

  // ── PeerConnection ───────────────────────────────────────────────────────────

  const createPC = useCallback((peerId) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) socket.emit('call:ice', { to: peerId, candidate });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] state:', state);

      if (state === 'connected') {
        clearTimeout(disconnectTimerRef.current);
        setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: Date.now() } : prev);
        // Apply loudspeaker after connection (audio element now has a stream)
        applySpeaker(true);
        return;
      }
      if (state === 'disconnected') {
        disconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.connectionState === 'disconnected') cleanupCall();
        }, 15000);
        return;
      }
      if (state === 'failed') {
        clearTimeout(disconnectTimerRef.current);
        if (pc.signalingState !== 'closed' && activeCallRef.current?.isOfferer) {
          pc.restartIce();
          disconnectTimerRef.current = setTimeout(() => {
            if (pcRef.current?.connectionState === 'failed') cleanupCall();
          }, 10000);
        } else {
          cleanupCall();
        }
        return;
      }
      if (state === 'closed') cleanupCall();
    };

    pcRef.current = pc;
    return pc;
  }, [socket, cleanupCall, applySpeaker]);

  // ── Start call ───────────────────────────────────────────────────────────────

  const startCall = useCallback(async (peer, callType) => {
    if (!socket || activeCallRef.current) return;
    try {
      setActiveCall({ peer, callType, status: 'calling', isMuted: false, isSpeaker: true, startTime: null, isOfferer: true });
      socket.emit('call:invite', { to: peer._id, callType });

      const stream = await getMedia(callType);
      const pc     = createPC(peer._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { to: peer._id, offer });
    } catch (err) {
      console.error('[Call] start failed:', err);
      alert(err.message || 'Could not start call. Check camera/mic permissions.');
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall]);

  // ── Answer call ──────────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    const { from, callType } = incoming;

    setIncomingCall(null);
    setActiveCall({ peer: from, callType, status: 'connecting', isMuted: false, isSpeaker: true, startTime: null, isOfferer: false });
    socket.emit('call:accept', { to: from._id });

    try {
      const stream = await getMedia(callType);
      const pc     = createPC(from._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const pending = pendingOfferRef.current;
      if (pending) {
        pendingOfferRef.current = null;
        await pc.setRemoteDescription(new RTCSessionDescription(pending));
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', { to: from._id, answer });
      }
    } catch (err) {
      console.error('[Call] answer failed:', err);
      alert(err.message || 'Could not answer call. Check camera/mic permissions.');
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall, flushPendingCandidates]);

  // ── Reject / End ─────────────────────────────────────────────────────────────

  const rejectCall = useCallback(() => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    socket.emit('call:reject', { to: incoming.from._id });
    setIncomingCall(null);
  }, [socket]);

  const endCall = useCallback(() => {
    const peerId = activeCallRef.current?.peer?._id || incomingCallRef.current?.from?._id;
    if (peerId && socket) socket.emit('call:end', { to: peerId });
    cleanupCall();
  }, [socket, cleanupCall]);

  // ── Capacitor native app handling ────────────────────────────────────────
  // Placed after answerCall/rejectCall declarations to avoid TDZ errors
  useEffect(() => {
    const onCapacitorAppResume = () => resumeAudio();
    const onCapacitorCallAnswer = () => answerCall();
    const onCapacitorCallDecline = () => rejectCall();

    window.addEventListener('capacitor:app-resumed', onCapacitorAppResume);
    window.addEventListener('capacitor:call-answer', onCapacitorCallAnswer);
    window.addEventListener('capacitor:call-decline', onCapacitorCallDecline);

    return () => {
      window.removeEventListener('capacitor:app-resumed', onCapacitorAppResume);
      window.removeEventListener('capacitor:call-answer', onCapacitorCallAnswer);
      window.removeEventListener('capacitor:call-decline', onCapacitorCallDecline);
    };
  }, [answerCall, rejectCall, resumeAudio]);

  // ── In-call controls ─────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setActiveCall(prev => prev ? { ...prev, isMuted: !track.enabled } : prev);
  }, []);

  const toggleSpeaker = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    const nextSpeaker = !current.isSpeaker;
    await applySpeaker(nextSpeaker);
    setActiveCall(prev => prev ? { ...prev, isSpeaker: nextSpeaker } : prev);
  }, [applySpeaker]);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setActiveCall(prev => prev ? { ...prev, isCameraOff: !track.enabled } : prev);
  }, []);

  // ── Socket listeners ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !user) return;
    const uid = user._id;

    const onIncoming = ({ from, callType }) => {
      if (activeCallRef.current) { socket.emit('call:reject', { to: from._id }); return; }
      setIncomingCall({ from, callType });
    };
    const onAccepted = () => setActiveCall(prev => prev ? { ...prev, status: 'connecting' } : prev);
    const onRejected = () => cleanupCall();
    const onEnded    = () => cleanupCall();

    const onOffer = async ({ offer }) => {
      if (!pcRef.current) { pendingOfferRef.current = offer; return; }
      const peerId = activeCallRef.current?.peer?._id || incomingCallRef.current?.from?._id;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates(pcRef.current);
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      if (peerId) socket.emit('call:answer', { to: peerId, answer });
    };

    const onAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingCandidates(pcRef.current);
    };

    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) { pendingIceRef.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.on(`call:incoming:${uid}`, onIncoming);
    socket.on(`call:accepted:${uid}`, onAccepted);
    socket.on(`call:rejected:${uid}`, onRejected);
    socket.on(`call:ended:${uid}`,    onEnded);
    socket.on(`call:offer:${uid}`,    onOffer);
    socket.on(`call:answer:${uid}`,   onAnswer);
    socket.on(`call:ice:${uid}`,      onIce);

    return () => {
      socket.off(`call:incoming:${uid}`, onIncoming);
      socket.off(`call:accepted:${uid}`, onAccepted);
      socket.off(`call:rejected:${uid}`, onRejected);
      socket.off(`call:ended:${uid}`,    onEnded);
      socket.off(`call:offer:${uid}`,    onOffer);
      socket.off(`call:answer:${uid}`,   onAnswer);
      socket.off(`call:ice:${uid}`,      onIce);
    };
  }, [socket, user, cleanupCall, flushPendingCandidates]);

  // ── SW message handler — answer/decline from push notification ──────────────
  useEffect(() => {
    const onSWMessage = (event) => {
      const { type } = event.data || {};
      if (type === 'CALL_ANSWER_FROM_NOTIFICATION') answerCall();
      if (type === 'CALL_DECLINE_FROM_NOTIFICATION') rejectCall();
    };
    navigator.serviceWorker?.addEventListener('message', onSWMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onSWMessage);
  }, [answerCall, rejectCall]);

  return (
    <CallContext.Provider value={{
      incomingCall, activeCall, isPiP,
      localVideoRef, remoteVideoRef, remoteAudioRef,
      startCall, answerCall, rejectCall, endCall,
      toggleMute, toggleSpeaker, toggleCamera,
      enterPiP, exitPiP,
    }}>
      {children}
    </CallContext.Provider>
  );
};
