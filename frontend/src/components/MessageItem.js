import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
const isEmojiOnly = (text) => {
  const stripped = (text || '').replace(/\s/g, '');
  const cleaned = stripped.replace(emojiRegex, '');
  return cleaned.length === 0 && stripped.length > 0;
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const MessageItem = ({ message, peer, onReply, onRecall, onPin, highlight }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isOwn = (message.senderId?._id || message.senderId) === user?._id;
  const sender = typeof message.senderId === 'object' ? message.senderId : null;
  const senderName = isOwn ? 'You' : (peer?.customNickname || sender?.name || 'Friend');
  const senderAvatar = sender?.avatar;

  const replyRef = message.replyTo;
  const emojiOnly = !message.isRecalled && isEmojiOnly(message.content);

  const handleRecall = async () => {
    if (!window.confirm('Recall this message?')) return;
    setBusy(true);
    try {
      await api.delete(`/messages/${message._id}`);
      onRecall?.(message._id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to recall');
    } finally { setBusy(false); }
  };

  const handlePin = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/messages/${message._id}/pin`);
      onPin?.(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Pin failed');
    } finally { setBusy(false); }
  };

  let replyPreview = null;
  if (replyRef && !replyRef.isRecalled) {
    const refSender = replyRef.senderId;
    const refIsMe = (refSender?._id || refSender) === user?._id;
    const refName = refIsMe ? 'You' : (typeof refSender === 'object' ? refSender?.name : 'them');
    replyPreview = { name: refName, content: replyRef.content };
  }

  return (
    <div
      className={`msg-row ${isOwn ? 'me' : 'you'}`}
      id={`msg-${message._id}`}
      style={highlight ? { background: 'rgba(255,182,193,0.15)', borderRadius: 16 } : undefined}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar — only for received messages */}
      {!isOwn && (
        <div style={{ width: 32, flexShrink: 0, alignSelf: 'flex-end', marginRight: 8 }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              style={{ width: 32, height: 32, borderRadius: '50%', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'white', fontWeight: 700
            }}>
              {senderName[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        gap: 2,
        maxWidth: '72%',
        position: 'relative'
      }}>
        {/* Sender name — only for received, non-emoji messages */}
        {!isOwn && !emojiOnly && !message.isRecalled && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#B08ABD', marginLeft: 4, marginBottom: 2 }}>
            {senderName}
          </span>
        )}

        {/* Bubble */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
          <div className={`msg-bubble-v2 ${isOwn ? 'own' : 'theirs'} ${emojiOnly ? 'emoji-only' : ''} ${message.isRecalled ? 'recalled' : ''}`}>
            {/* Reply preview */}
            {replyPreview && (
              <div className="reply-preview">
                <div className="reply-preview-bar" />
                <div>
                  <div className="reply-preview-name">{replyPreview.name}</div>
                  <div className="reply-preview-text">{replyPreview.content}</div>
                </div>
              </div>
            )}

            {/* Message text */}
            <div className="bubble-text">{message.content}</div>

            {/* Time + pin */}
            {!emojiOnly && (
              <div className="bubble-meta">
                {message.isPinned && <span title="Pinned" style={{ fontSize: 10 }}>📌</span>}
                <span>{formatTime(message.timestamp)}</span>
              </div>
            )}
          </div>

          {/* Floating action toolbar — appears on hover */}
          {!message.isRecalled && showActions && (
            <div className={`msg-toolbar ${isOwn ? 'toolbar-left' : 'toolbar-right'}`}>
              <button
                title="Reply"
                onClick={() => onReply?.(message)}
                disabled={busy}
              >↩</button>
              <button
                title={message.isPinned ? 'Unpin' : 'Pin'}
                onClick={handlePin}
                disabled={busy}
              >{message.isPinned ? '📌' : '📍'}</button>
              {isOwn && (
                <button
                  title="Recall"
                  onClick={handleRecall}
                  disabled={busy}
                  style={{ color: '#e57373' }}
                >🗑</button>
              )}
            </div>
          )}
        </div>

        {/* Time for emoji-only messages */}
        {emojiOnly && (
          <span style={{ fontSize: 10, color: '#BBBBBB', paddingInline: 4 }}>
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>

      {/* Spacer on own side so bubble doesn't touch edge */}
      {isOwn && <div style={{ width: 8, flexShrink: 0 }} />}
    </div>
  );
};

export default MessageItem;
