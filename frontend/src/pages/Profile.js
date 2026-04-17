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

const Profile = () => {
  const { user, updateName, updateProfile, checkName } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(extractSeed(user?.avatar));
  const [status, setStatus] = useState('');
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
    setStatus('');
    let ok = true;
    if (name.trim() && name !== user.name) {
      const r = await updateName(name.trim());
      if (!r.success) { setStatus(r.error); ok = false; }
    }
    const newAvatarUrl = getAvatarUrl(avatar);
    if (ok && newAvatarUrl !== user.avatar) {
      const r2 = await updateProfile({ avatar: newAvatarUrl });
      if (!r2.success) { setStatus(r2.error); ok = false; }
    }
    setBusy(false);
    if (ok) setStatus('Saved! ✿');
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        ← Back
      </button>
      <div className="card pop-in">
        <h2 style={{ marginTop: 0 }}>🎨 Change your look</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <img className="avatar-lg sticker-bounce" src={getAvatarUrl(avatar)} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>{name || user.name}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Login code: <code>{user?.loginCode}</code></p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            <span style={{ fontSize: 13, color: '#888' }}>Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameStatus({ type: 'idle', msg: '' }); }}
              onBlur={handleCheck}
              maxLength={20}
            />
            {nameStatus.msg && (
              <p style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: nameStatus.type === 'ok' ? '#4fa865' : '#e57373'
              }}>{nameStatus.msg}</p>
            )}
          </label>

          <label>
            <span style={{ fontSize: 13, color: '#888' }}>Sticker face</span>
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
          </label>

          {status && <p style={{ fontSize: 13, color: status.includes('Saved') ? '#4fa865' : '#e57373' }}>{status}</p>}

          <button className="btn" disabled={busy || nameStatus.type === 'err'} type="submit">
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
