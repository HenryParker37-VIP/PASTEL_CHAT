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
  }, []);

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
            {birthdays.map(bday => (
              <div key={bday._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>
                      🎂 {bday.friendName}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                      {bday.date}
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
            ))}
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowNoteModal(false)}>
          <div
            style={{
              background: 'white', borderRadius: 20, padding: 28,
              width: 'min(480px, 90vw)', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>📝 {t('mySpaceNewNote')}</h3>
            <form onSubmit={handleCreateNote}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceNoteTitle')}
              </label>
              <input
                className="input"
                placeholder={t('mySpaceNoteTitle')}
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                style={{ marginBottom: 16 }}
                autoFocus
              />

              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceNoteContent')}
              </label>
              <textarea
                className="input"
                placeholder={t('mySpaceNoteContent')}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                style={{ marginBottom: 16, minHeight: 120, resize: 'vertical' }}
              />

              {friends.length > 0 && (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 10 }}>
                    {t('mySpaceShareWith')}
                  </label>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    {friends.map(f => (
                      <label
                        key={f.friendId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                          background: noteSharedWith.includes(f.friendId) ? '#FFF0F5' : '#FAFAFA',
                          border: noteSharedWith.includes(f.friendId) ? '1.5px solid #DDA0DD' : '1.5px solid #EEE'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={noteSharedWith.includes(f.friendId)}
                          onChange={() => toggleFriendShare(f.friendId)}
                          style={{ accentColor: '#DDA0DD' }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.customNickname}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn" style={{ flex: 1 }}>
                  💾 {t('save')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowNoteModal(false); setNoteTitle(''); setNoteContent(''); setNoteSharedWith([]); }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowReminderModal(false)}>
          <div
            style={{
              background: 'white', borderRadius: 20, padding: 28,
              width: 'min(420px, 90vw)', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>⏰ {t('mySpaceNewReminder')}</h3>
            <form onSubmit={handleCreateReminder}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceReminderDate')}
              </label>
              <input
                type="date"
                className="input"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                style={{ marginBottom: 16 }}
                autoFocus
              />

              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceReminderTime')}
              </label>
              <input
                type="time"
                className="input"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceReminderText')}
              </label>
              <textarea
                className="input"
                placeholder={t('mySpaceReminderText')}
                value={reminderText}
                onChange={e => setReminderText(e.target.value)}
                style={{ marginBottom: 20, minHeight: 80, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn" style={{ flex: 1 }}>
                  ⏰ {t('save')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowReminderModal(false); setReminderDate(''); setReminderTime(''); setReminderText(''); }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Birthday Modal */}
      {showBirthdayModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowBirthdayModal(false)}>
          <div
            style={{
              background: 'white', borderRadius: 20, padding: 28,
              width: 'min(420px, 90vw)', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>🎂 {t('mySpaceNewBirthday')}</h3>
            <form onSubmit={handleCreateBirthday}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceFriendName')}
              </label>
              <select
                className="input"
                value={birthdayFriendId}
                onChange={e => setBirthdayFriendId(e.target.value)}
                style={{ marginBottom: 16 }}
                autoFocus
              >
                <option value="">{t('mySpaceSelectFriend')}</option>
                {friends.map(f => (
                  <option key={f.friendId} value={f.friendId}>
                    {f.customNickname}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('mySpaceReminderDate')} (MM-DD)
              </label>
              <input
                className="input"
                placeholder="MM-DD"
                value={birthdayDate}
                onChange={e => setBirthdayDate(e.target.value)}
                style={{ marginBottom: 20 }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn" style={{ flex: 1 }}>
                  🎂 {t('save')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowBirthdayModal(false); setBirthdayFriendId(''); setBirthdayDate(''); }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivateSpace;
