import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n';

const PrivateSpace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSharedWith, setNoteSharedWith] = useState([]);

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderText, setReminderText] = useState('');

  // Birthday modal state
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [birthdayFriendId, setBirthdayFriendId] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notesRes, remindersRes, birthdaysRes, friendsRes] = await Promise.all([
        api.get('/private-space/notes'),
        api.get('/private-space/reminders'),
        api.get('/private-space/birthdays'),
        api.get('/friends')
      ]);
      setNotes(notesRes.data || []);
      setReminders(remindersRes.data || []);
      setBirthdays(birthdaysRes.data || []);
      setFriends(friendsRes.data || []);
    } catch (e) {
      console.error('Failed to load private space data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    try {
      const { data } = await api.post('/private-space/notes', {
        title: noteTitle,
        content: noteContent,
        sharedWith: noteSharedWith
      });
      setNotes(prev => [data, ...prev]);
      setShowNoteModal(false);
      setNoteTitle('');
      setNoteContent('');
      setNoteSharedWith([]);
    } catch (e) {
      console.error('Failed to create note:', e);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm(t('mySpaceDeleteConfirm'))) return;
    try {
      await api.delete(`/private-space/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n._id !== noteId));
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!reminderDate || !reminderTime || !reminderText.trim()) return;
    try {
      const { data } = await api.post('/private-space/reminders', {
        date: reminderDate,
        time: reminderTime,
        text: reminderText
      });
      setReminders(prev => [...prev, data].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
      setShowReminderModal(false);
      setReminderDate('');
      setReminderTime('');
      setReminderText('');
    } catch (e) {
      console.error('Failed to create reminder:', e);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!window.confirm(t('mySpaceDeleteConfirm'))) return;
    try {
      await api.delete(`/private-space/reminders/${reminderId}`);
      setReminders(prev => prev.filter(r => r._id !== reminderId));
    } catch (e) {
      console.error('Failed to delete reminder:', e);
    }
  };

  const handleCreateBirthday = async (e) => {
    e.preventDefault();
    const friend = friends.find(f => f.friendId === birthdayFriendId);
    if (!friend || !birthdayDate) return;
    try {
      const { data } = await api.post('/private-space/birthdays', {
        friendId: birthdayFriendId,
        friendName: friend.customNickname,
        date: birthdayDate
      });
      setBirthdays(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setShowBirthdayModal(false);
      setBirthdayFriendId('');
      setBirthdayDate('');
    } catch (e) {
      console.error('Failed to create birthday:', e);
    }
  };

  const handleDeleteBirthday = async (birthdayId) => {
    if (!window.confirm(t('mySpaceDeleteConfirm'))) return;
    try {
      await api.delete(`/private-space/birthdays/${birthdayId}`);
      setBirthdays(prev => prev.filter(b => b._id !== birthdayId));
    } catch (e) {
      console.error('Failed to delete birthday:', e);
    }
  };

  const toggleFriendShare = (friendId) => {
    setNoteSharedWith(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <h2 style={{ margin: '4px 0 20px' }}>{t('mySpaceTitle')}</h2>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
        {[
          { key: 'notes', label: t('mySpaceNotes'), emoji: '📝' },
          { key: 'reminders', label: t('mySpaceReminders'), emoji: '⏰' },
          { key: 'birthdays', label: t('mySpaceBirthdays'), emoji: '🎂' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              padding: '8px 14px',
              background: tab === item.key ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#F5F5F5',
              border: 'none',
              borderRadius: 10,
              color: tab === item.key ? 'white' : '#666',
              fontWeight: tab === item.key ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {item.emoji} {item.label}
          </button>
        ))}
      </div>

      {/* Notes Tab */}
      {tab === 'notes' && (
        <div>
          <button
            className="btn btn-lavender"
            onClick={() => setShowNoteModal(true)}
            style={{ marginBottom: 20 }}
          >
            {t('mySpaceNewNote')}
          </button>
          {notes.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#888' }}>{t('mySpaceNoNotes')}</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {notes.map(note => (
              <div key={note._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{note.title}</h4>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {note.content.slice(0, 200)}{note.content.length > 200 ? '...' : ''}
                    </p>
                    {note.sharedWith && note.sharedWith.length > 0 && (
                      <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                        👥 Shared with {note.sharedWith.length} friend{note.sharedWith.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDeleteNote(note._id)}
                    style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminders Tab */}
      {tab === 'reminders' && (
        <div>
          <button
            className="btn btn-lavender"
            onClick={() => setShowReminderModal(true)}
            style={{ marginBottom: 20 }}
          >
            {t('mySpaceNewReminder')}
          </button>
          {reminders.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#888' }}>{t('mySpaceNoReminders')}</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {reminders.map(reminder => (
              <div key={reminder._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#C06080 ' }}>
                        {reminder.date} at {reminder.time}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#555' }}>{reminder.text}</p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDeleteReminder(reminder._id)}
                    style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Birthdays Tab */}
      {tab === 'birthdays' && (
        <div>
          <button
            className="btn btn-lavender"
            onClick={() => setShowBirthdayModal(true)}
            style={{ marginBottom: 20 }}
          >
            {t('mySpaceNewBirthday')}
          </button>
          {birthdays.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#888' }}>{t('mySpaceNoBirthdays')}</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {birthdays.map(bday => {
              const parts = bday.date ? bday.date.split('-') : [];
              const hasYear = parts.length === 3;
              const birthYear = hasYear ? parseInt(parts[0], 10) : null;
              const month = hasYear ? parts[1] : parts[0];
              const day = hasYear ? parts[2] : parts[1];
              const currentYear = new Date().getFullYear();
              const age = birthYear ? currentYear - birthYear : null;
              const today = new Date();
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const dd = String(today.getDate()).padStart(2, '0');
              const isToday = `${month}-${day}` === `${mm}-${dd}`;
              const formatted = birthYear
                ? new Date(parseInt(birthYear), parseInt(month) - 1, parseInt(day))
                    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : `${month}/${day}`;
              return (
                <div key={bday._id} className="card" style={{ borderLeft: isToday ? '4px solid #FFB6C1' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>
                        {isToday ? '🎉' : '🎂'} {bday.friendName}
                        {isToday && <span style={{ marginLeft: 8, fontSize: 12, color: '#C06080', fontWeight: 700 }}>TODAY!</span>}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                        {formatted}{age ? ` · Turns ${age} this year` : ''}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleDeleteBirthday(bday._id)}
                      style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Shared modal styles ─────────────────────────────────────────── */}
      {/* backdrop */ }
      {(showNoteModal || showReminderModal || showBirthdayModal) && (() => {
        const BACKDROP = {
          position: 'fixed', inset: 0,
          background: 'rgba(10,8,24,0.72)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        };
        const CARD = {
          background: 'linear-gradient(160deg, #1e1a35 0%, #251f3e 100%)',
          border: '1px solid rgba(221,160,221,0.18)',
          borderRadius: 24,
          padding: '28px 26px 24px',
          width: 'min(460px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,182,193,0.08)'
        };
        const LABEL = {
          fontSize: 11, fontWeight: 700, color: '#c4a3dc',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'block', marginBottom: 6
        };
        const INPUT_EXTRA = {
          background: 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(221,160,221,0.22)',
          color: '#f0e8ff',
          borderRadius: 12
        };
        const TITLE = { margin: '0 0 22px', fontSize: 18, fontWeight: 700, color: '#f5eeff' };
        const BTN_SAVE = {
          flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
          color: 'white', fontSize: 14, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(221,160,221,0.35)'
        };
        const BTN_CANCEL = {
          padding: '11px 18px', borderRadius: 14,
          border: '1.5px solid rgba(221,160,221,0.25)',
          background: 'transparent', cursor: 'pointer',
          color: '#b09acc', fontSize: 14, fontWeight: 600
        };

        if (showNoteModal) return (
          <div style={BACKDROP} onClick={() => setShowNoteModal(false)}>
            <div style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>📝 {t('mySpaceNewNote')}</h3>
              <form onSubmit={handleCreateNote}>
                <label style={LABEL}>{t('mySpaceNoteTitle')}</label>
                <input
                  className="input"
                  placeholder={t('mySpaceNoteTitle')}
                  value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16 }}
                  autoFocus
                />

                <label style={LABEL}>{t('mySpaceNoteContent')}</label>
                <textarea
                  className="input"
                  placeholder={t('mySpaceNoteContent')}
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16, minHeight: 120, resize: 'vertical' }}
                />

                {friends.length > 0 && (
                  <>
                    <label style={{ ...LABEL, marginBottom: 10 }}>{t('mySpaceShareWith')}</label>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                      {friends.map(f => (
                        <label
                          key={f.friendId}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                            background: noteSharedWith.includes(f.friendId)
                              ? 'rgba(221,160,221,0.15)' : 'rgba(255,255,255,0.04)',
                            border: noteSharedWith.includes(f.friendId)
                              ? '1.5px solid rgba(221,160,221,0.5)' : '1.5px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={noteSharedWith.includes(f.friendId)}
                            onChange={() => toggleFriendShare(f.friendId)}
                            style={{ accentColor: '#DDA0DD' }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#e8dcff' }}>{f.customNickname}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>💾 {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => { setShowNoteModal(false); setNoteTitle(''); setNoteContent(''); setNoteSharedWith([]); }}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        if (showReminderModal) return (
          <div style={BACKDROP} onClick={() => setShowReminderModal(false)}>
            <div style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>⏰ {t('mySpaceNewReminder')}</h3>
              <form onSubmit={handleCreateReminder}>
                <label style={LABEL}>{t('mySpaceReminderDate')}</label>
                <input
                  type="date"
                  className="input"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16 }}
                  autoFocus
                />

                <label style={LABEL}>{t('mySpaceReminderTime')}</label>
                <input
                  type="time"
                  className="input"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16 }}
                />

                <label style={LABEL}>{t('mySpaceReminderText')}</label>
                <textarea
                  className="input"
                  placeholder={t('mySpaceReminderText')}
                  value={reminderText}
                  onChange={e => setReminderText(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 20, minHeight: 80, resize: 'vertical' }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>⏰ {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => { setShowReminderModal(false); setReminderDate(''); setReminderTime(''); setReminderText(''); }}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        if (showBirthdayModal) return (
          <div style={BACKDROP} onClick={() => setShowBirthdayModal(false)}>
            <div style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>🎂 {t('mySpaceNewBirthday')}</h3>
              <form onSubmit={handleCreateBirthday}>
                <label style={LABEL}>{t('mySpaceFriendName')}</label>
                <select
                  className="input"
                  value={birthdayFriendId}
                  onChange={e => setBirthdayFriendId(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16 }}
                  autoFocus
                >
                  <option value="" style={{ background: '#1e1a35' }}>{t('mySpaceSelectFriend')}</option>
                  {friends.map(f => (
                    <option key={f.friendId} value={f.friendId} style={{ background: '#1e1a35' }}>
                      {f.customNickname}
                    </option>
                  ))}
                </select>

                <label style={LABEL}>Date of Birth</label>
                <input
                  type="date"
                  className="input"
                  value={birthdayDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setBirthdayDate(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 24 }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>🎂 {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => { setShowBirthdayModal(false); setBirthdayFriendId(''); setBirthdayDate(''); }}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        return null;
      })()}
    </div>
  );
};

export default PrivateSpace;
