import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

// Build ICE server list. STUN discovers public IPs; TURN relays when direct P2P
// is blocked by NAT (required for 4G/5G and cross-network calls).
// Override with REACT_APP_TURN_* env vars to use your own TURN server.
const buildIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl      = process.env.REACT_APP_TURN_URL;
  const turnUser     = process.env.REACT_APP_TURN_USERNAME;
  const turnCred     = process.env.REACT_APP_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    // Custom TURN server configured via env vars (recommended for production)
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  } else {
    // Free public TURN relay (OpenRelay by Metered) — good for development.
    // For production get a free account at https://metered.ca or use Twilio.
    servers.push(
      { urls: 'turn:openrelay.metered.ca:80',                   username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',                  username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp',    username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turns:openrelay.metered.ca:443',                 username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }

  return servers;
};

const ICE_CONFIG = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10, // pre-gather candidates to speed up connection
  iceTransportPolicy: 'all', // try direct first, fall back to TURN relay
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall]     = useState(null);

  const pcRef             = useRef(null);
  const localStreamRef    = useRef(null);
  const remoteStreamRef   = useRef(null);
  const localVideoRef     = useRef(null);
  const remoteVideoRef    = useRef(null);
  const remoteAudioRef    = useRef(null);

  // Refs so socket listeners always read current values without stale closures
  const activeCallRef     = useRef(null);
  const incomingCallRef   = useRef(null);
  const pendingOfferRef   = useRef(null);  // offer that arrived before PC was created
  const pendingIceRef     = useRef([]);    // ICE candidates buffered before remoteDescription is set
  const disconnectTimerRef = useRef(null); // grace period before treating disconnected as failed

  useEffect(() => { activeCallRef.current   = activeCall;  }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // ── Media helpers ──────────────────────────────────────────────────────────

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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Camera/microphone permission denied. Please allow access and try again.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('No camera or microphone found on this device.');
      }
      throw err;
    }
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  // ── ICE candidate buffer ───────────────────────────────────────────────────
  // Candidates must be buffered until setRemoteDescription has been called.
  // Without this, candidates arriving during getUserMedia / PC creation are lost.

  const flushPendingCandidates = useCallback(async (pc) => {
    const buffered = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        // ignore stale candidates from a previous call
      }
    }
  }, []);

  // ── PeerConnection ─────────────────────────────────────────────────────────

  const cleanupCall = useCallback(() => {
    clearTimeout(disconnectTimerRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current   = [];
    stopMedia();
    setActiveCall(null);
    setIncomingCall(null);
  }, [stopMedia]);

  const createPC = useCallback((peerId) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('call:ice', { to: peerId, candidate });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] connection state:', state);

      if (state === 'connected') {
        clearTimeout(disconnectTimerRef.current);
        setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: Date.now() } : prev);
        return;
      }

      if (state === 'disconnected') {
        // Transient — mobile networks drop briefly when switching towers/WiFi.
        // Give it 15 s to self-recover before treating it as failed.
        disconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.connectionState === 'disconnected') {
            console.log('[WebRTC] disconnected too long, ending call');
            cleanupCall();
          }
        }, 15000);
        return;
      }

      if (state === 'failed') {
        clearTimeout(disconnectTimerRef.current);
        // Attempt ICE restart (renegotiates candidates without dropping the call)
        if (pc.signalingState !== 'closed' && activeCallRef.current?.isOfferer) {
          console.log('[WebRTC] ICE failed, attempting restart...');
          pc.restartIce();
          // If restart doesn't recover within 10 s, give up
          disconnectTimerRef.current = setTimeout(() => {
            if (pcRef.current?.connectionState === 'failed') cleanupCall();
          }, 10000);
        } else {
          cleanupCall();
        }
        return;
      }

      if (state === 'closed') {
        cleanupCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, cleanupCall]);

  // ── Initiate call ──────────────────────────────────────────────────────────

  const startCall = useCallback(async (peer, callType) => {
    if (!socket || activeCallRef.current) return;
    try {
      setActiveCall({ peer, callType, status: 'calling', isMuted: false, isSpeaker: false, startTime: null, isOfferer: true });
      socket.emit('call:invite', { to: peer._id, callType });

      const stream = await getMedia(callType);
      const pc     = createPC(peer._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { to: peer._id, offer });
    } catch (err) {
      console.error('[Call] start failed:', err);
      alert(err.message || 'Could not start call. Check camera/mic permissions.');
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall]);

  // ── Answer call ────────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    const { from, callType } = incoming;

    setIncomingCall(null);
    setActiveCall({ peer: from, callType, status: 'connecting', isMuted: false, isSpeaker: false, startTime: null, isOfferer: false });
    socket.emit('call:accept', { to: from._id });

    try {
      const stream  = await getMedia(callType);
      const pc      = createPC(from._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const pending = pendingOfferRef.current;
      if (pending) {
        pendingOfferRef.current = null;
        await pc.setRemoteDescription(new RTCSessionDescription(pending));
        // Flush any ICE candidates that arrived before we created the PC
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

  // ── Reject / end ───────────────────────────────────────────────────────────

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

  // ── In-call controls ───────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setActiveCall(prev => prev ? { ...prev, isMuted: !audioTrack.enabled } : prev);
  }, []);

  const toggleSpeaker = useCallback(async () => {
    setActiveCall(prev => {
      if (!prev) return prev;
      const nextSpeaker = !prev.isSpeaker;
      const el = remoteAudioRef.current || remoteVideoRef.current;
      if (el && typeof el.setSinkId === 'function') {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const speaker  = devices.find(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'));
          const earpiece = devices.find(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('ear'));
          const target   = nextSpeaker ? (speaker?.deviceId || '') : (earpiece?.deviceId || '');
          el.setSinkId(target).catch(() => {});
        });
      }
      return { ...prev, isSpeaker: nextSpeaker };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setActiveCall(prev => prev ? { ...prev, isCameraOff: !videoTrack.enabled } : prev);
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !user) return;
    const uid = user._id;

    const onIncoming = ({ from, callType }) => {
      if (activeCallRef.current) {
        socket.emit('call:reject', { to: from._id });
        return;
      }
      setIncomingCall({ from, callType });
    };

    const onAccepted = () => {
      setActiveCall(prev => prev ? { ...prev, status: 'connecting' } : prev);
    };

    const onRejected = () => cleanupCall();
    const onEnded    = () => cleanupCall();

    const onOffer = async ({ offer }) => {
      if (!pcRef.current) {
        // PC not ready yet — buffer offer until answerCall() creates the PC
        pendingOfferRef.current = offer;
        return;
      }
      // Re-negotiation path (PC already exists)
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
      // Flush any ICE candidates that arrived before the answer was processed
      await flushPendingCandidates(pcRef.current);
    };

    const onIce = async ({ candidate }) => {
      if (!candidate) return;

      // If PC doesn't exist yet, or remote description hasn't been set yet,
      // buffer the candidate — dropping it breaks ICE negotiation.
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        // Ignore — can happen with stale candidates after renegotiation
      }
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

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      localVideoRef,
      remoteVideoRef,
      remoteAudioRef,
      startCall,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleSpeaker,
      toggleCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
};
