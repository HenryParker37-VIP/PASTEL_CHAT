import React, { useState, useRef } from 'react';
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

const isCustomPhoto = (url) => url && url.startsWith('data:');

// Crop + resize image to a square 200×200 data URL
const cropToCircleDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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
  const [customPhoto, setCustomPhoto] = useState(isCustomPhoto(user?.avatar) ? user.avatar : null);
  const [avatarMode, setAvatarMode] = useState(isCustomPhoto(user?.avatar) ? 'photo' : 'sticker');
  const [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState(user?.status || '');
  const [saveStatus, setSaveStatus] = useState('');
  const [nameStatus, setNameStatus] = useState({ type: 'idle', msg: '' });
  const [busy, setBusy] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await cropToCircleDataUrl(file);
      setCustomPhoto(dataUrl);
      setAvatarMode('photo');
    } catch {
      alert('Could not process image. Please try another file.');
    }
  };

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
      const newAvatarUrl = avatarMode === 'photo' && customPhoto ? customPhoto : getAvatarUrl(avatar);
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
            <img
              className="avatar-lg sticker-bounce"
              src={avatarMode === 'photo' && customPhoto ? customPhoto : getAvatarUrl(avatar)}
              alt=""
              style={{ objectFit: 'cover', borderRadius: '50%' }}
            />
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
          <div>
            <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 8 }}>Profile picture</span>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[{ key: 'sticker', label: '🐾 Sticker face' }, { key: 'photo', label: '📷 My photo' }].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAvatarMode(tab.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: avatarMode === tab.key ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'var(--search-bg)',
                    color: avatarMode === tab.key ? 'white' : 'var(--subtext)',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {avatarMode === 'sticker' ? (
              <AvatarPicker selected={avatar} onSelect={setAvatar} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {customPhoto ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={customPhoto}
                      alt="Your photo"
                      style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '3px solid #DDA0DD' }}
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomPhoto(null); setAvatarMode('sticker'); }}
                      style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#FF8FA3', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: 'white', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      width: 90, height: 90, borderRadius: '50%',
                      border: '2px dashed #DDA0DD', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 4, background: 'rgba(221,160,221,0.06)', transition: 'background 0.2s'
                    }}
                  >
                    <span style={{ fontSize: 24 }}>📷</span>
                    <span style={{ fontSize: 10, color: '#B08ABD', fontWeight: 600 }}>Upload</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    padding: '7px 18px', borderRadius: 20, border: '1.5px solid #DDA0DD',
                    background: 'transparent', cursor: 'pointer',
                    fontSize: 13, color: '#B08ABD', fontWeight: 600
                  }}
                >
                  {customPhoto ? 'Change photo' : 'Choose from library'}
                </button>
                <p style={{ margin: 0, fontSize: 11, color: '#bbb', textAlign: 'center' }}>
                  Any shape — auto-cropped to circle · max 5 MB
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>

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
