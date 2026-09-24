import React, { useEffect, useState } from 'react';
import api from '../services/api';
import PastelIcon from './PastelIcon';
import { resolveCharacterAvatar } from '../utils/characterAvatar';
import { useSocket } from '../contexts/SocketContext';
import { prepareLyraAvatarUpload } from '../utils/lyraAvatarMedia';

const AIDebugModal = ({ onClose, onRefreshChat }) => {
  const { lyraAvatar, setLyraAvatar } = useSocket();
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState(null);
  const [memories, setMemories] = useState([]);
  const [relationship, setRelationship] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, memRes, relRes] = await Promise.all([
        api.get('/ai/status'),
        api.get('/ai/memories'),
        api.get('/ai/relationship')
      ]);
      setAiStatus(statusRes.data);
      setMemories(memRes.data || []);
      setRelationship(relRes.data || null);
    } catch (e) {
      console.error('Failed to load AI debug info:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerProactiveTick = async () => {
    setBusy(true);
    setActionMessage('');
    try {
      const { data } = await api.post('/ai/proactive/tick', {});
      if (data.triggered) {
        setActionMessage(`${data.triggered} proactive check-in sent`);
        if (onRefreshChat) onRefreshChat();
      } else {
        setActionMessage(`Proactive skipped: ${data.reason || 'Attention budget capped'}`);
      }
      loadData();
    } catch (e) {
      setActionMessage('Failed to trigger proactive tick');
    } finally {
      setBusy(false);
    }
  };

  const resetRelationship = async () => {
    if (!window.confirm('Reset Lyra memories and relationship metrics for your account?')) return;
    setBusy(true);
    try {
      await api.post('/ai/debug/reset-relationship');
      setActionMessage('Relationship and memories reset to day 1.');
      loadData();
    } catch (e) {
      setActionMessage('Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteMemory = async (id) => {
    try {
      await api.delete(`/ai/memories/${id}`);
      setMemories(m => m.filter(item => item._id !== id));
    } catch (e) {
      console.error('Failed to delete memory', e.message);
    }
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    const previousAvatar = aiStatus?.user?.avatar || null;
    let prepared = null;
    setBusy(true);
    try {
      prepared = await prepareLyraAvatarUpload(file);
      setLyraAvatar(prepared.previewUrl);
      setAiStatus((prev) => ({ ...prev, user: { ...(prev?.user || {}), avatar: prepared.previewUrl } }));
      const { data } = await api.post('/ai/avatar', { avatar: prepared.dataUrl });
      if (!data.success) throw new Error('Failed to update avatar');
      setLyraAvatar(data.avatar);
      setAiStatus((prev) => ({ ...prev, user: { ...(prev?.user || {}), avatar: data.avatar } }));
      setActionMessage('Avatar updated successfully!');
      loadData();
      if (onRefreshChat) onRefreshChat();
    } catch (err) {
      setLyraAvatar(previousAvatar);
      setAiStatus((prev) => ({ ...prev, user: { ...(prev?.user || {}), avatar: previousAvatar } }));
      setActionMessage(err.response?.data?.message || err.message || 'Failed to update avatar');
    } finally {
      prepared?.dispose();
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text, #333333)',
          borderRadius: 20,
          maxWidth: 480,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <img
                src={resolveCharacterAvatar({ friend: aiStatus?.user, friendId: 'user_ai_lyra', avatarOverride: lyraAvatar })}
                alt="Lyra"
                style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #b5ead7', objectFit: 'cover', display: 'block' }}
              />
              <label
                title="Change Avatar"
                style={{
                  position: 'absolute', bottom: -2, right: -2,
                  background: 'white', border: '1.5px solid #b5ead7',
                  borderRadius: '50%', width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                }}
              >
                <PastelIcon name="camera" size={11} style={{ color: '#555' }} />
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Choose Lyra avatar image"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0, padding: 0, border: 0 }}
                  onChange={handleUploadAvatar}
                />
              </label>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{aiStatus?.user?.name || 'Lyra'}</h3>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                {aiStatus?.character?.role || 'Barista & Graphic Design Student'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <PastelIcon name="close" size={14} />
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Loading character state...</p>
        ) : (
          <>
            {/* Inner State Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              background: '#faf7fc',
              padding: 12,
              borderRadius: 14,
              border: '1px solid #f0e6f6'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Mood</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6a5182' }}>
                  {aiStatus?.state?.mood || 'cozy'} 🍵
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Activity</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6a5182' }}>
                  {aiStatus?.state?.current_activity || 'chilling'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Rhythm</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6a5182' }}>
                  {aiStatus?.state?.sleep_state === 'sleeping' ? '💤 asleep' : '✨ awake'}
                </div>
              </div>
            </div>

            {/* Relationship Progress */}
            {relationship && (
              <div style={{
                background: '#f9fbfa',
                padding: 12,
                borderRadius: 14,
                border: '1px solid #e5f4ee',
                fontSize: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#2e6b56' }}>Relationship Familiarity</span>
                  <span style={{ fontWeight: 700, color: '#2e6b56' }}>Level {Math.round(relationship.familiarity || 1)}/10</span>
                </div>
                <div style={{ background: '#e0f0ea', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (relationship.familiarity || 1) * 10)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #b5ead7, #85dcb9)'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#777', fontSize: 11 }}>
                  <span>Comfort: {Math.round((relationship.comfort || 1) * 10)}%</span>
                  <span>Trust: {Math.round((relationship.trust || 1) * 10)}%</span>
                  <span>Sleep Intent: {relationship.sleep_intent_received ? '🌙 Active' : 'Off'}</span>
                </div>
              </div>
            )}

            {/* Active Life Events */}
            {aiStatus?.activeLifeEvents?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#555' }}>
                  What’s Happening In Her Life
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aiStatus.activeLifeEvents.map(evt => (
                    <div key={evt._id} style={{
                      background: '#fffbf5',
                      border: '1px solid #fce8cc',
                      padding: '8px 12px',
                      borderRadius: 10,
                      fontSize: 12
                    }}>
                      <div style={{ fontWeight: 600, color: '#a05c10' }}>{evt.title}</div>
                      <div style={{ color: '#666', marginTop: 2 }}>{evt.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deep Memories */}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#555', display: 'flex', justifyContent: 'space-between' }}>
                <span>Memories About You</span>
                <span style={{ fontWeight: 400, color: '#888' }}>{memories.length} remembered</span>
              </h4>
              {memories.length === 0 ? (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#aaa', fontSize: 12, fontStyle: 'italic' }}>
                  Tell Lyra your favorite music, drinks, or what you are working on — she will remember!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {memories.map(m => (
                    <div key={m._id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8f9fa',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 12
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#4a4063' }}>{m.key}: </span>
                        <span style={{ color: '#555' }}>{m.value}</span>
                      </div>
                      <button
                        onClick={() => deleteMemory(m._id)}
                        title="Forget this memory"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb' }}
                      >
                        <PastelIcon name="close" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Feedback message */}
            {actionMessage && (
              <div style={{
                background: '#f0f4ff',
                color: '#3452b4',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                textAlign: 'center'
              }}>
                {actionMessage}
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                disabled={busy}
                onClick={triggerProactiveTick}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #c7ceea',
                  background: 'linear-gradient(135deg, #e2f0cb, #c7ceea)',
                  color: '#3f385c',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                Trigger Proactive Message
              </button>
              <button
                disabled={busy}
                onClick={resetRelationship}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #ffd1dc',
                  background: '#fff0f3',
                  color: '#b23b68',
                  fontSize: 12,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIDebugModal;
