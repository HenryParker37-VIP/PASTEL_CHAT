import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getIceServers } from '../services/api';
import { useToast } from '../components/Toast';
import { useLang } from '../i18n';
import { addCallKitListener, callKitInvoke } from '../services/callkit';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const ICE_CONFIG = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const createCallUUID = () => {
  const cryptoApi = window.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user }   = useAuth();
  const { push } = useToast();
  const { t } = useLang();

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall,   setActiveCall]   = useState(null);
  const [isPiP,        setIsPiP]        = useState(false);
  const iceConfigRef       = useRef(ICE_CONFIG);
  const iceConfigReadyRef  = useRef(Promise.resolve());

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
  const restartInFlightRef = useRef(false);
  const callKitUUIDRef      = useRef(null);

  // Fetch short-lived/provider-managed TURN credentials only after auth.
  useEffect(() => {
    if (!socket || !user) return;
    iceConfigReadyRef.current = getIceServers().then((iceServers) => {
      const hasTurn = Array.isArray(iceServers) && iceServers.some((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('turn'));
      });
      if (!hasTurn) throw new Error('Backend returned no TURN server');
      iceConfigRef.current = { ...ICE_CONFIG, iceServers };
      console.info('[WebRTC] TURN configuration loaded from authenticated backend');
    }).catch((err) => {
      iceConfigRef.current = ICE_CONFIG;
      console.error('[WebRTC] TURN configuration unavailable:', err.message);
    });
  }, [socket, user]);

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

  const activateNativeAudio = useCallback(() =>
    callKitInvoke('activateAudio'), []);

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
        if (activeCallRef.current) activateNativeAudio();
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
  }, [activateNativeAudio, enterPiP, resumeAudio]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanupCall = useCallback(() => {
    const callUUID = callKitUUIDRef.current;
    if (callUUID) {
      callKitInvoke('reportEnded', { uuid: callUUID, reason: 'remote' });
      callKitUUIDRef.current = null;
    }
    callKitInvoke('deactivateAudio');
    clearTimeout(disconnectTimerRef.current);
    exitPiP();
    pcRef.current?.close();
    pcRef.current       = null;
    pendingOfferRef.current = null;
    pendingIceRef.current   = [];
    stopMedia();
    restartInFlightRef.current = false;
    setActiveCall(null);
    setIncomingCall(null);
    setIsPiP(false);
  }, [stopMedia, exitPiP]);

  // ── PeerConnection ───────────────────────────────────────────────────────────

  const createPC = useCallback((peerId) => {
    const pc = new RTCPeerConnection(iceConfigRef.current);

    const logSelectedPair = async () => {
      try {
        const stats = await pc.getStats();
        let pair;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && (report.selected || report.nominated) && report.state === 'succeeded') pair = report;
        });
        if (!pair) return;
        const local = stats.get(pair.localCandidateId);
        const remote = stats.get(pair.remoteCandidateId);
        console.info('[WebRTC] selected ICE candidate pair', {
          localType: local?.candidateType,
          remoteType: remote?.candidateType,
          localProtocol: local?.protocol,
          remoteProtocol: remote?.protocol,
          state: pair.state,
        });
      } catch (err) { console.warn('[WebRTC] stats unavailable:', err.message); }
    };

    const restartIce = () => {
      if (restartInFlightRef.current || pc.signalingState === 'closed') return;
      restartInFlightRef.current = true;
      pc.createOffer({ iceRestart: true }).then(async (offer) => {
        await pc.setLocalDescription(offer);
        socket?.emit('call:offer', { to: peerId, offer, iceRestart: true });
        console.info('[WebRTC] ICE restart offer sent');
      }).catch((err) => console.error('[WebRTC] ICE restart failed:', err.message))
        .finally(() => { restartInFlightRef.current = false; });
    };

    pc.onicegatheringstatechange = () => console.info('[WebRTC] ICE gathering state:', pc.iceGatheringState);
    pc.onicecandidateerror = (event) => console.error('[WebRTC] ICE candidate error:', {
      url: event.url, errorCode: event.errorCode, errorText: event.errorText,
    });
    pc.oniceconnectionstatechange = () => {
      console.info('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') logSelectedPair();
      if (pc.iceConnectionState === 'disconnected' && activeCallRef.current?.isOfferer) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(restartIce, 3000);
      }
    };
    pc.onsignalingstatechange = () => console.info('[WebRTC] signaling state:', pc.signalingState);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        const candidateType = candidate.candidate?.match(/ typ ([a-z]+)/)?.[1] || 'unknown';
        console.info('[WebRTC] local ICE candidate:', candidateType);
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
        // Apply loudspeaker after connection (audio element now has a stream)
        applySpeaker(true);
        if (callKitUUIDRef.current) {
          callKitInvoke('reportConnected', { uuid: callKitUUIDRef.current });
        }
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
          restartIce();
          disconnectTimerRef.current = setTimeout(() => {
            if (pcRef.current?.connectionState === 'failed') cleanupCall();
          }, 20000);
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
      await iceConfigReadyRef.current;
      const callUUID = createCallUUID();
      callKitUUIDRef.current = callUUID;
      setActiveCall({ peer, callType, status: 'calling', isMuted: false, isSpeaker: true, startTime: null, isOfferer: true });
      callKitInvoke('startOutgoingCall', {
        uuid: callUUID,
        handle: peer._id,
        displayName: peer.name,
        hasVideo: callType === 'video',
      });
      socket.emit('call:invite', { to: peer._id, callType });

      await activateNativeAudio();
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
      push({ icon: 'alert', title: t('feedbackCallFailed'), body: err.message, tone: 'error' });
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall, push, t, activateNativeAudio]);

  // ── Answer call ──────────────────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    const { from, callType } = incoming;

    setIncomingCall(null);
    if (!callKitUUIDRef.current) callKitUUIDRef.current = createCallUUID();
    setActiveCall({ peer: from, callType, status: 'connecting', isMuted: false, isSpeaker: true, startTime: null, isOfferer: false });
    socket.emit('call:accept', { to: from._id });

    try {
      await iceConfigReadyRef.current;
      await activateNativeAudio();
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
      push({ icon: 'alert', title: t('feedbackCallFailed'), body: err.message, tone: 'error' });
      cleanupCall();
    }
  }, [socket, getMedia, createPC, cleanupCall, flushPendingCandidates, push, t, activateNativeAudio]);

  // ── Reject / End ─────────────────────────────────────────────────────────────

  const rejectCall = useCallback(() => {
    const incoming = incomingCallRef.current;
    if (!incoming || !socket) return;
    socket.emit('call:reject', { to: incoming.from._id });
    if (callKitUUIDRef.current) {
      callKitInvoke('reportEnded', { uuid: callKitUUIDRef.current, reason: 'declined' });
      callKitUUIDRef.current = null;
    }
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
    const onCapacitorAppResume = () => {
      if (activeCallRef.current) activateNativeAudio();
      resumeAudio();
    };
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
  }, [activateNativeAudio, answerCall, rejectCall, resumeAudio]);

  // CallKit actions are translated back into the existing WebRTC lifecycle.
  // No native action creates a second peer connection or independent call state.
  useEffect(() => {
    const removeListener = addCallKitListener('callKitAction', ({ action, uuid, muted, outputs }) => {
      if (uuid && callKitUUIDRef.current && uuid !== callKitUUIDRef.current) return;
      if (action === 'answer') answerCall();
      if (action === 'end' || action === 'reset') {
        if (incomingCallRef.current && !activeCallRef.current) rejectCall();
        else endCall();
      }
      if (action === 'mute') {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track || typeof muted !== 'boolean') return;
        track.enabled = !muted;
        setActiveCall(prev => prev ? { ...prev, isMuted: muted } : prev);
      }
      if (action === 'audioActivated' || action === 'audioResumed') resumeAudio();
      if (action === 'routeChanged' && Array.isArray(outputs)) {
        setActiveCall(prev => prev ? { ...prev, isSpeaker: outputs.includes('Speaker') } : prev);
      }
    });
    return removeListener;
  }, [answerCall, endCall, rejectCall, resumeAudio]);

  // ── In-call controls ─────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setActiveCall(prev => prev ? { ...prev, isMuted: !track.enabled } : prev);
    if (callKitUUIDRef.current) {
      callKitInvoke('setMuted', { uuid: callKitUUIDRef.current, muted: !track.enabled });
    }
  }, []);

  const toggleSpeaker = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    const nextSpeaker = !current.isSpeaker;
    await applySpeaker(nextSpeaker);
    if (callKitUUIDRef.current) {
      await callKitInvoke('setSpeaker', { enabled: nextSpeaker });
    }
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
      const callUUID = createCallUUID();
      callKitUUIDRef.current = callUUID;
      callKitInvoke('reportIncomingCall', {
        uuid: callUUID,
        handle: from._id,
        displayName: from.name,
        hasVideo: callType === 'video',
      }).then((result) => {
        setIncomingCall({ from, callType, nativeCallKit: result?.reported === true });
      });
    };
    const onAccepted = () => setActiveCall(prev => prev ? { ...prev, status: 'connecting' } : prev);
    const onRejected = () => cleanupCall();
    const onEnded    = () => cleanupCall();

    const onOffer = async ({ offer, iceRestart }) => {
      if (!pcRef.current) { pendingOfferRef.current = offer; return; }
      const peerId = activeCallRef.current?.peer?._id || incomingCallRef.current?.from?._id;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingCandidates(pcRef.current);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        if (peerId) socket.emit('call:answer', { to: peerId, answer, iceRestart: Boolean(iceRestart) });
        console.info('[WebRTC] remote offer applied', iceRestart ? '(ICE restart)' : '');
      } catch (err) { console.error('[WebRTC] remote offer failed:', err.message); }
    };

    const onAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(pcRef.current);
      } catch (err) { console.error('[WebRTC] remote answer failed:', err.message); }
    };

    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) { pendingIceRef.current.push(candidate); return; }
      try {
        const candidateType = candidate.candidate?.match(/ typ ([a-z]+)/)?.[1] || 'unknown';
        console.info('[WebRTC] remote ICE candidate:', candidateType);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { console.warn('[WebRTC] add remote ICE candidate failed:', err.message); }
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
