import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n';

// Synthesise a soft multi-tone bell chime via Web Audio API
const playBell = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const chime = (freq, t, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur);
    };
    const now = ctx.currentTime;
    // First ring
    chime(880,  now,        1.6);
    chime(1109, now + 0.28, 1.3);
    chime(660,  now + 0.56, 1.8);
    // Second ring after 2 s
    chime(880,  now + 2.1,  1.6);
    chime(1109, now + 2.4,  1.3);
    chime(660,  now + 2.7,  1.8);
  } catch (_) { /* AudioContext unavailable */ }
};

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

  // Animation + alarm state
  const [closingModal, setClosingModal] = useState(null); // 'note'|'reminder'|'birthday'
  const [activeAlarm, setActiveAlarm] = useState(null);   // fired reminder object
  const firedRef = useRef(new Set());                      // IDs already rung

  useEffect(() => { loadData(); }, [user]);

  // Animated close: play exit anim, then actually hide
  const closeModal = (which, reset) => {
    setClosingModal(which);
    setTimeout(() => { setClosingModal(null); reset(); }, 210);
  };

  // Reminder ticker — checks every 30 s
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const yy  = now.getFullYear();
      const mm  = String(now.getMonth() + 1).padStart(2, '0');
      const dd  = String(now.getDate()).padStart(2, '0');
      const hh  = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const today = `${yy}-${mm}-${dd}`;
      const timeNow = `${hh}:${min}`;
      reminders.forEach(r => {
        if (r.date === today && r.time === timeNow && !firedRef.current.has(r._id)) {
          firedRef.current.add(r._id);
          setActiveAlarm(r);
          playBell();
        }
      });
    };
    check(); // run immediately on mount / reminder change
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [reminders]);

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
    <div className="container" style={{ paddingBottom: 40 }}>
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 24 }}>
        {t('back')}
      </button>

      {/* Header section */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {t('mySpaceTitle')}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#999' }}>Keep your memories, reminders, and celebrations in one special place</p>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'notes', label: t('mySpaceNotes'), emoji: '📝', color: '#FFB6C1' },
          { key: 'reminders', label: t('mySpaceReminders'), emoji: '⏰', color: '#87CEEB' },
          { key: 'birthdays', label: t('mySpaceBirthdays'), emoji: '🎂', color: '#FFD700' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              padding: '10px 18px',
              background: tab === item.key ? `linear-gradient(135deg, ${item.color}, ${item.color}dd)` : 'rgba(255,255,255,0.08)',
              border: tab === item.key ? 'none' : `1px solid rgba(255,255,255,0.12)`,
              borderRadius: 12,
              color: tab === item.key ? 'white' : '#aaa',
              fontWeight: tab === item.key ? 700 : 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.25s ease',
              fontSize: 14,
              boxShadow: tab === item.key ? `0 4px 16px ${item.color}40` : 'none'
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
            style={{ marginBottom: 24, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
          >
            + {t('mySpaceNewNote')}
          </button>
          {notes.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'linear-gradient(135deg, rgba(255,182,193,0.08), rgba(221,160,221,0.08))',
              borderRadius: 16, border: '1px solid rgba(255,182,193,0.2)'
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📝</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#fff' }}>No notes yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#999' }}>Start capturing your thoughts and ideas</p>
              <button
                onClick={() => setShowNoteModal(true)}
                style={{
                  padding: '8px 16px', background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                  border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Create your first note
              </button>
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
            style={{ marginBottom: 24, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
          >
            + {t('mySpaceNewReminder')}
          </button>
          {reminders.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'linear-gradient(135deg, rgba(135,206,235,0.08), rgba(176,224,230,0.08))',
              borderRadius: 16, border: '1px solid rgba(135,206,235,0.2)'
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⏰</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#fff' }}>No reminders yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#999' }}>Never miss an important moment</p>
              <button
                onClick={() => setShowReminderModal(true)}
                style={{
                  padding: '8px 16px', background: 'linear-gradient(135deg, #87CEEB, #B0E0E6)',
                  border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Set your first reminder
              </button>
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
            style={{ marginBottom: 24, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
          >
            + {t('mySpaceNewBirthday')}
          </button>
          {birthdays.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,165,0,0.08))',
              borderRadius: 16, border: '1px solid rgba(255,215,0,0.2)'
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎂</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#fff' }}>No birthdays tracked</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#999' }}>Celebrate special days with friends</p>
              <button
                onClick={() => setShowBirthdayModal(true)}
                style={{
                  padding: '8px 16px', background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Add a birthday
              </button>
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

      {/* ── Animated modals ──────────────────────────────────────────────── */}
      {(() => {
        if (!showNoteModal && !showReminderModal && !showBirthdayModal && !closingModal) return null;

        const exiting = closingModal;
        const BACKDROP = (which) => ({
          position: 'fixed', inset: 0,
          background: 'rgba(10,8,24,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
          className: exiting === which ? 'backdrop-out' : 'backdrop-in'
        });
        const cardClass = (which) => exiting === which ? 'modal-out' : 'modal-in';
        const CARD = {
          background: 'linear-gradient(160deg, #1e1a35 0%, #251f3e 100%)',
          border: '1px solid rgba(221,160,221,0.18)',
          borderRadius: 24, padding: '28px 26px 24px',
          width: 'min(460px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
        };
        const LABEL = {
          fontSize: 11, fontWeight: 700, color: '#c4a3dc',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          display: 'block', marginBottom: 6
        };
        const INPUT_EXTRA = {
          background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(221,160,221,0.22)',
          color: '#f0e8ff', borderRadius: 12
        };
        const TITLE = { margin: '0 0 22px', fontSize: 18, fontWeight: 700, color: '#f5eeff' };
        const BTN_SAVE = {
          flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
          color: 'white', fontSize: 14, fontWeight: 700,
          boxShadow: '0 4px 16px rgba(221,160,221,0.4)'
        };
        const BTN_CANCEL = {
          padding: '12px 18px', borderRadius: 14,
          border: '1.5px solid rgba(221,160,221,0.25)',
          background: 'transparent', cursor: 'pointer',
          color: '#b09acc', fontSize: 14, fontWeight: 600
        };

        // Note modal
        if (showNoteModal || exiting === 'note') return (
          <div
            style={{ position:'fixed', inset:0, background:'rgba(10,8,24,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
            className={exiting === 'note' ? 'backdrop-out' : 'backdrop-in'}
            onClick={() => closeModal('note', () => { setShowNoteModal(false); setNoteTitle(''); setNoteContent(''); setNoteSharedWith([]); })}
          >
            <div className={cardClass('note')} style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>📝 {t('mySpaceNewNote')}</h3>
              <form onSubmit={handleCreateNote}>
                <label style={LABEL}>{t('mySpaceNoteTitle')}</label>
                <input className="input" placeholder={t('mySpaceNoteTitle')} value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)} style={{ ...INPUT_EXTRA, marginBottom: 16 }} autoFocus />

                <label style={LABEL}>{t('mySpaceNoteContent')}</label>
                <textarea className="input" placeholder={t('mySpaceNoteContent')} value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 16, minHeight: 120, resize: 'vertical' }} />

                {friends.length > 0 && (
                  <>
                    <label style={{ ...LABEL, marginBottom: 10 }}>{t('mySpaceShareWith')}</label>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                      {friends.map(f => (
                        <label key={f.friendId} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                          background: noteSharedWith.includes(f.friendId) ? 'rgba(221,160,221,0.15)' : 'rgba(255,255,255,0.04)',
                          border: noteSharedWith.includes(f.friendId) ? '1.5px solid rgba(221,160,221,0.5)' : '1.5px solid rgba(255,255,255,0.08)'
                        }}>
                          <input type="checkbox" checked={noteSharedWith.includes(f.friendId)}
                            onChange={() => toggleFriendShare(f.friendId)} style={{ accentColor: '#DDA0DD' }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#e8dcff' }}>{f.customNickname}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>💾 {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => closeModal('note', () => { setShowNoteModal(false); setNoteTitle(''); setNoteContent(''); setNoteSharedWith([]); })}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        // Reminder modal
        if (showReminderModal || exiting === 'reminder') return (
          <div
            style={{ position:'fixed', inset:0, background:'rgba(10,8,24,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
            className={exiting === 'reminder' ? 'backdrop-out' : 'backdrop-in'}
            onClick={() => closeModal('reminder', () => { setShowReminderModal(false); setReminderDate(''); setReminderTime(''); setReminderText(''); })}
          >
            <div className={cardClass('reminder')} style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>⏰ {t('mySpaceNewReminder')}</h3>
              <form onSubmit={handleCreateReminder}>
                <label style={LABEL}>{t('mySpaceReminderDate')}</label>
                <input type="date" className="input" value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)} style={{ ...INPUT_EXTRA, marginBottom: 16 }} autoFocus />

                <label style={LABEL}>{t('mySpaceReminderTime')}</label>
                <input type="time" className="input" value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)} style={{ ...INPUT_EXTRA, marginBottom: 16 }} />

                <label style={LABEL}>{t('mySpaceReminderText')}</label>
                <textarea className="input" placeholder={t('mySpaceReminderText')} value={reminderText}
                  onChange={e => setReminderText(e.target.value)}
                  style={{ ...INPUT_EXTRA, marginBottom: 20, minHeight: 80, resize: 'vertical' }} />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>⏰ {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => closeModal('reminder', () => { setShowReminderModal(false); setReminderDate(''); setReminderTime(''); setReminderText(''); })}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        // Birthday modal
        if (showBirthdayModal || exiting === 'birthday') return (
          <div
            style={{ position:'fixed', inset:0, background:'rgba(10,8,24,0.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 }}
            className={exiting === 'birthday' ? 'backdrop-out' : 'backdrop-in'}
            onClick={() => closeModal('birthday', () => { setShowBirthdayModal(false); setBirthdayFriendId(''); setBirthdayDate(''); })}
          >
            <div className={cardClass('birthday')} style={CARD} onClick={e => e.stopPropagation()}>
              <h3 style={TITLE}>🎂 {t('mySpaceNewBirthday')}</h3>
              <form onSubmit={handleCreateBirthday}>
                <label style={LABEL}>{t('mySpaceFriendName')}</label>
                <select className="input" value={birthdayFriendId}
                  onChange={e => setBirthdayFriendId(e.target.value)} style={{ ...INPUT_EXTRA, marginBottom: 16 }} autoFocus>
                  <option value="" style={{ background: '#1e1a35' }}>{t('mySpaceSelectFriend')}</option>
                  {friends.map(f => (
                    <option key={f.friendId} value={f.friendId} style={{ background: '#1e1a35' }}>{f.customNickname}</option>
                  ))}
                </select>

                <label style={LABEL}>Date of Birth</label>
                <input type="date" className="input" value={birthdayDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setBirthdayDate(e.target.value)} style={{ ...INPUT_EXTRA, marginBottom: 24 }} />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={BTN_SAVE}>🎂 {t('save')}</button>
                  <button type="button" style={BTN_CANCEL}
                    onClick={() => closeModal('birthday', () => { setShowBirthdayModal(false); setBirthdayFriendId(''); setBirthdayDate(''); })}>
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

        return null;
      })()}

      {/* ── Reminder alarm popup ─────────────────────────────────────────── */}
      {activeAlarm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(8,6,20,0.82)',
          backdropFilter: 'blur(10px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 600
        }}>
          <div className="alarm-popup alarm-glow" style={{
            background: 'linear-gradient(160deg, #211b3a 0%, #2c2050 100%)',
            border: '1px solid rgba(255,182,193,0.3)',
            borderRadius: 28, padding: '36px 30px 28px',
            width: 'min(360px, 88vw)', textAlign: 'center',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7)'
          }}>
            <div className="alarm-bell" style={{ fontSize: 52, marginBottom: 8 }}>🔔</div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#c4a3dc', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Reminder
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#f5eeff', lineHeight: 1.35 }}>
              {activeAlarm.text}
            </p>
            <p style={{ margin: '0 0 28px', fontSize: 13, color: '#9b87bb' }}>
              {activeAlarm.date} · {activeAlarm.time}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  // Snooze: re-fire in 5 minutes
                  firedRef.current.delete(activeAlarm._id);
                  const future = new Date();
                  future.setMinutes(future.getMinutes() + 5);
                  const snoozeReminder = {
                    ...activeAlarm,
                    _id: activeAlarm._id + '_snooze_' + Date.now(),
                    date: future.toISOString().split('T')[0],
                    time: `${String(future.getHours()).padStart(2,'0')}:${String(future.getMinutes()).padStart(2,'0')}`
                  };
                  setReminders(prev => [...prev, snoozeReminder]);
                  setActiveAlarm(null);
                }}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 14,
                  border: '1.5px solid rgba(221,160,221,0.3)',
                  background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                  color: '#d4b8f0', fontSize: 14, fontWeight: 600
                }}
              >
                💤 Snooze 5 min
              </button>
              <button
                onClick={() => setActiveAlarm(null)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                  color: 'white', fontSize: 14, fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(221,160,221,0.4)'
                }}
              >
                ✓ Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateSpace;
