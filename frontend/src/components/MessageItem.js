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

  const isOwn = (message.senderId?._id || message.senderId) === user?._id;
  const sender = typeof message.senderId === 'object' ? message.senderId : null;
  const senderName = isOwn ? 'You' : (peer?.customNickname || sender?.name || 'Friend');

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

  // "(SenderName replied to you/friend: content)"
  let replyLine = null;
  if (replyRef && !replyRef.isRecalled) {
    const refSender = replyRef.senderId;
    const refIsMe = (refSender?._id || refSender) === user?._id;
    const refName = refIsMe ? 'you' : (typeof refSender === 'object' ? refSender?.name : 'them');
    replyLine = `(${senderName} replied to ${refName}: ${replyRef.content})`;
  }

  return (
    <div className={`msg-row ${isOwn ? 'me' : 'you'} pop-in`} id={`msg-${message._id}`} style={highlight ? { background: 'rgba(255,182,193,0.25)', borderRadius: 12 } : null}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: 2 }}>
        <div className={`msg-bubble ${emojiOnly ? 'emoji-only' : ''} ${message.isRecalled ? 'recalled' : ''}`}>
          {replyLine && <div className="reply-ref">{replyLine}</div>}
          <div>{message.content}</div>
          <div className="meta">
            {message.isPinned && <span className="pin" title="Pinned">📌</span>}
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>
        {!message.isRecalled && (
          <div className="msg-actions">
            <button onClick={() => onReply?.(message)} disabled={busy}>↩ Reply</button>
            <button onClick={handlePin} disabled={busy}>{message.isPinned ? '📌 Unpin' : '📌 Pin'}</button>
            {isOwn && <button onClick={handleRecall} disabled={busy}>🗑 Recall</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
