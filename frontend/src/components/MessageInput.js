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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
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
    setShowEmoji(false);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + emoji.length;
    }, 0);
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="chat-input-area">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="reply-bar">
          <div className="reply-bar-accent" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="reply-bar-name">
              Replying to {replyingTo.senderId?.name || 'message'}
            </div>
            <div className="reply-bar-text">{replyingTo.content}</div>
          </div>
          <button className="reply-bar-close" onClick={onCancelReply}>✕</button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="emoji-picker">
          {EMOJI_LIST.map((e) => (
            <button
              key={e}
              onClick={() => insertEmoji(e)}
              className="emoji-btn"
            >{e}</button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="input-row">
        <button
          className={`icon-btn ${showEmoji ? 'active' : ''}`}
          onClick={() => setShowEmoji(v => !v)}
          title="Emoji"
          type="button"
        >
          😊
        </button>

        <div className="input-pill">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={replyingTo ? 'Write a reply…' : 'Message…'}
            disabled={disabled || sending}
            rows={1}
            className="message-textarea"
          />
        </div>

        <button
          className={`send-btn ${hasText ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!hasText || sending || disabled}
          title="Send"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
