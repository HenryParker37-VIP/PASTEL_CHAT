import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

const EMOJI_LIST = ['😀','😂','🥰','😍','🤩','😎','🥳','🤗','😊','😉',
  '❤️','💕','💖','💗','🌸','🌺','✨','🌟','💫','⭐',
  '🎉','🎊','🎈','🎀','🌈','🦋','🌻','🍀','🌙','☀️',
  '👍','🙌','👏','🤝','💪','🫶','🥺','😭','😅','🤣'];

const MessageInput = ({ onSend, to, replyingTo, onCancelReply, disabled }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const emitTyping = useCallback((isTyping) => {
    if (!to) return;
    socket?.emit('user_typing', { to, isTyping });
  }, [socket, to]);

  const handleChange = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    emitTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    clearTimeout(typingTimerRef.current);
    emitTyping(false);
    try {
      await onSend(content);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + emoji.length;
    }, 0);
  };

  return (
    <div className="chat-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      {replyingTo && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: 'rgba(221,160,221,0.12)', borderRadius: 10, marginBottom: 8
        }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 0, alignItems: 'flex-start' }}>
            <div style={{ width: 3, background: 'var(--lavender)', borderRadius: 2, minHeight: 30 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lavender)' }}>
                Replying to {replyingTo.senderId?.name || 'message'}
              </div>
              <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyingTo.content}
              </div>
            </div>
          </div>
          <button onClick={onCancelReply} style={{ fontSize: 18, color: '#999' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          title="Emoji"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: showEmoji ? 'var(--soft-pink)' : 'rgba(0,0,0,0.04)',
            fontSize: 20
          }}
        >😊</button>

        {showEmoji && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: 10,
            width: 280,
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 4,
            zIndex: 30
          }}>
            {EMOJI_LIST.map((e) => (
              <button
                key={e}
                onClick={() => { insertEmoji(e); setShowEmoji(false); }}
                style={{ fontSize: 22, padding: 4, borderRadius: 8 }}
              >{e}</button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? 'Write a reply...' : 'Type a message...'}
          disabled={disabled || sending}
          rows={1}
          className="input"
          style={{
            borderRadius: 20,
            minHeight: 40,
            maxHeight: 120,
            resize: 'none',
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.5
          }}
        />

        <button
          className="btn"
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          style={{ width: 44, height: 44, padding: 0, borderRadius: '50%' }}
          title="Send"
        >
          <span style={{ transform: 'translateX(1px)' }}>➤</span>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
