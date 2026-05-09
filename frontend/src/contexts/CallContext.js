import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Refs so socket listeners always read current values without stale closures
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const pendingOfferRef = useRef(null); // buffer offer that arrives before PC is ready

  // Keep refs in sync with state
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // ── Media helpers ─────────────────────────────────────────────────────────

  const getMedia = useCallback(async (callType) => {
    const constraints = callType === 'video'
      ? { video: { facingMode: 'user' }, audio: true }
      : { video: false, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  // ── PeerConnection ────────────────────────────────────────────────────────

  const createPC = useCallback((peerId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

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
      if (pc.connectionState === 'connected') {
        setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: Date.now() } : prev);
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanupCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket]); // eslint-disable-line

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingOfferRef.current = null;
    stopMedia();
    setActiveCall(null);
    setIncomingCall(null);
  }, [stopMedia]);

  // ── Initiate call ─────────────────────────────────────────────────────────

  const startCall = useCallback(async (peer, callType) => {
    if (!socket || activeCallRef.current) return;
    try {
      setActiveCall({ peer, callType, status: 'calling', isMuted: false, isSpeaker: false, startTime: null });
      socket.emit('call:invite', { to: peer._id, callType });

      const stream = await getMedia(callType);
      const pc = createPC(peer._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { to: peer._id, offer });
    } catch (err) {
      console.error('Call start failed:', err);
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall]);

  // ── Answer call ───────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    const { from, callType } = incoming;

    setIncomingCall(null);
    setActiveCall({ peer: from, callType, status: 'connecting', isMuted: false, isSpeaker: false, startTime: null });
    socket.emit('call:accept', { to: from._id });

    try {
      const stream = await getMedia(callType);
      const pc = createPC(from._id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Process offer that may have arrived before we answered
      const pending = pendingOfferRef.current;
      if (pending) {
        pendingOfferRef.current = null;
        await pc.setRemoteDescription(new RTCSessionDescription(pending));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', { to: from._id, answer });
      }
    } catch (err) {
      console.error('Answer failed:', err);
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall]);

  // ── Reject / end ──────────────────────────────────────────────────────────

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

  // ── In-call controls ──────────────────────────────────────────────────────

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
          const speaker = devices.find(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'));
          const earpiece = devices.find(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('ear'));
          const target = nextSpeaker ? (speaker?.deviceId || '') : (earpiece?.deviceId || '');
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

  // ── Socket listeners (only depend on socket+user, use refs for live state) ─

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
    const onEnded = () => cleanupCall();

    const onOffer = async ({ offer }) => {
      if (!pcRef.current) {
        // PC not ready yet — buffer the offer until answerCall() creates the PC
        pendingOfferRef.current = offer;
        return;
      }
      // PC already exists (e.g. re-negotiation)
      const peerId = activeCallRef.current?.peer?._id || incomingCallRef.current?.from?._id;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      if (peerId) socket.emit('call:answer', { to: peerId, answer });
    };

    const onAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIce = async ({ candidate }) => {
      if (!pcRef.current || !candidate) return;
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.on(`call:incoming:${uid}`, onIncoming);
    socket.on(`call:accepted:${uid}`, onAccepted);
    socket.on(`call:rejected:${uid}`, onRejected);
    socket.on(`call:ended:${uid}`, onEnded);
    socket.on(`call:offer:${uid}`, onOffer);
    socket.on(`call:answer:${uid}`, onAnswer);
    socket.on(`call:ice:${uid}`, onIce);

    return () => {
      socket.off(`call:incoming:${uid}`, onIncoming);
      socket.off(`call:accepted:${uid}`, onAccepted);
      socket.off(`call:rejected:${uid}`, onRejected);
      socket.off(`call:ended:${uid}`, onEnded);
      socket.off(`call:offer:${uid}`, onOffer);
      socket.off(`call:answer:${uid}`, onAnswer);
      socket.off(`call:ice:${uid}`, onIce);
    };
  }, [socket, user, cleanupCall]); // stable deps only — refs handle live state

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
      toggleCamera
    }}>
      {children}
    </CallContext.Provider>
  );
};
