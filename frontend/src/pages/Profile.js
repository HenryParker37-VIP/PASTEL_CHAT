import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AvatarPicker from '../components/AvatarPicker';
import AVATARS, { getAvatarUrl } from '../data/avatars';

const extractSeed = (url) => {
  try {
    const m = url && url.match(/[?&]seed=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : AVATARS[0].seed;
  } catch {
    return AVATARS[0].seed;
  }
};

const STATUS_PRESETS = [
  { emoji: '🟢', label: 'Available' },
  { emoji: '🔴', label: 'Busy' },
  { emoji: '💤', label: 'Away' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎵', label: 'Listening' },
  { emoji: '📚', label: 'Studying' },
  { emoji: '💼', label: 'Working' },
  { emoji: '🍕', label: 'Eating' },
  { emoji: '✈️', label: 'Traveling' },
  { emoji: '🏃', label: 'Working out' },
];

const Profile = () => {
  const { user, updateName, updateProfile, checkName } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(extractSeed(user?.avatar));
  const [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState(user?.status || '');
  const [saveStatus, setSaveStatus] = useState('');
  const [nameStatus, setNameStatus] = useState({ type: 'idle', msg: '' });
  const [busy, setBusy] = useState(false);

  const handleCheck = async () => {
    if (!name.trim() || name === user.name) {
      setNameStatus({ type: 'idle', msg: '' });
      return;
    }
    const r = await checkName(name);
    if (r.available) setNameStatus({ type: 'ok', msg: 'This name is free ✿' });
    else setNameStatus({ type: 'err', msg: r.reason || 'Name already used' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaveStatus('');
    let ok = true;

    if (name.trim() && name !== user.name) {
      const r = await updateName(name.trim());
      if (!r.success) { setSaveStatus(r.error); ok = false; }
    }

    if (ok) {
      const patch = { bio, status };
      const newAvatarUrl = getAvatarUrl(avatar);
      if (newAvatarUrl !== user.avatar) patch.avatar = newAvatarUrl;
      const r2 = await updateProfile(patch);
      if (!r2.success) { setSaveStatus(r2.error); ok = false; }
    }

    setBusy(false);
    if (ok) setSaveStatus('Saved! ✿');
  };

  const pickPreset = (preset) => {
    setStatus(`${preset.emoji} ${preset.label}`);
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        ← Back
      </button>
      <div className="card pop-in">
        <h2 style={{ marginTop: 0 }}>🎨 Your Profile</h2>

        {/* Avatar preview + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <img className="avatar-lg sticker-bounce" src={getAvatarUrl(avatar)} alt="" />
            {status && (
              <span style={{
                position: 'absolute', bottom: -2, right: -2,
                fontSize: 18, lineHeight: 1
              }}>
                {status.split(' ')[0]}
              </span>
            )}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>{name || user?.name}</p>
            {bio && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{bio}</p>}
            {status && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#B08ABD' }}>{status}</p>}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#bbb' }}>
              Code: <code style={{ background: '#F7F0FA', padding: '1px 6px', borderRadius: 6 }}>{user?.loginCode}</code>
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name */}
          <label>
            <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>Display Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameStatus({ type: 'idle', msg: '' }); }}
              onBlur={handleCheck}
              maxLength={20}
            />
            {nameStatus.msg && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: nameStatus.type === 'ok' ? '#4fa865' : '#e57373' }}>
                {nameStatus.msg}
              </p>
            )}
          </label>

          {/* Bio */}
          <label>
            <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>
              Bio <span style={{ color: '#ccc' }}>({bio.length}/120)</span>
            </span>
            <textarea
              className="input"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 120))}
              placeholder="Tell friends a little about yourself..."
              rows={2}
              style={{ resize: 'none', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5 }}
            />
          </label>

          {/* Status */}
          <div>
            <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>Status</span>
            {/* Preset chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {STATUS_PRESETS.map((preset) => {
                const full = `${preset.emoji} ${preset.label}`;
                const active = status === full;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => pickPreset(preset)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? '#DDA0DD' : '#EEE0D8'}`,
                      background: active ? 'rgba(221,160,221,0.15)' : 'white',
                      color: active ? '#9B59B6' : '#666',
                      fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontWeight: active ? 600 : 400
                    }}
                  >
                    {preset.emoji} {preset.label}
                  </button>
                );
              })}
              {status && (
                <button
                  type="button"
                  onClick={() => setStatus('')}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: '1.5px solid #eee', background: 'white',
                    color: '#bbb', fontSize: 12, cursor: 'pointer'
                  }}
                >✕ Clear</button>
              )}
            </div>
            {/* Custom status input */}
            <input
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 60))}
              placeholder="Or type a custom status..."
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Avatar */}
          <label>
            <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>Sticker face</span>
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
          </label>

          {saveStatus && (
            <p style={{ fontSize: 13, color: saveStatus.includes('Saved') ? '#4fa865' : '#e57373', margin: 0 }}>
              {saveStatus}
            </p>
          )}

          <button className="btn" disabled={busy || nameStatus.type === 'err'} type="submit">
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
