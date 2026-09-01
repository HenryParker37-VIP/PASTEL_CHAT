import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import GifStickerPicker from './GifStickerPicker';
import SmartSuggestionBar from './SmartSuggestionBar';
import PastelIcon from './PastelIcon';

const EMOJI_LIST = ['😀','😂','🥰','😍','🤩','😎','🥳','🤗','😊','😉',
  '❤️','💕','💖','💗','🌸','🌺','✨','🌟','💫','⭐',
  '🎉','🎊','🎈','🎀','🌈','🦋','🌻','🍀','🌙','☀️',
  '👍','🙌','👏','🤝','💪','🫶','🥺','😭','😅','🤣'];

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MessageInput = ({ onSend, to, replyingTo, onCancelReply, disabled }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [suggestedGifQuery, setSuggestedGifQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [media, setMedia] = useState(null); // { type, dataUrl, name, size, preview }
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      alert('File too large. Max 8 MB.');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMedia({
        type: isImage ? 'image' : 'file',
        dataUrl: ev.target.result,
        name: file.name,
        size: file.size,
        preview: isImage ? ev.target.result : null,
      });
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const handleSend = async () => {
    const content = text.trim();
    if ((!content && !media) || sending) return;
    setSending(true);
    clearTimeout(typingTimerRef.current);
    emitTyping(false);
    try {
      const mediaPayload = media
        ? { type: media.type, dataUrl: media.dataUrl, name: media.name, size: media.size }
        : null;
      await onSend(content, mediaPayload);
      setText('');
      setMedia(null);
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

  const handleGifSelect = async ({ type, url, preview, previewUrl, width, height, provider, sourceId, stickerId, emoji, label, imageUrl, name }) => {
    setShowGifPicker(false);
    setSending(true);
    try {
      if (type === 'sticker') {
        // Illustrated sticker — send as sticker media with imageUrl
        await onSend('', {
          type: 'sticker',
          stickerId,
          imageUrl,
          name: name || label || emoji,
        });
      } else if (type === 'emoji-sticker') {
        // Legacy emoji sticker — send as plain text
        await onSend(emoji, null);
      } else {
        // GIF — send as attachment with URL
        await onSend('', { type: 'gif', url, preview, previewUrl, width, height, provider, sourceId, name: name || 'GIF' });
      }
    } finally {
      setSending(false);
    }
  };

  const handleSuggestedSticker = (sticker) => handleGifSelect({
    type: 'sticker', stickerId: sticker.id, imageUrl: sticker.asset,
    label: sticker.labelVi || sticker.label, name: sticker.label
  });

  const handleSuggestedGif = (query) => {
    setSuggestedGifQuery(query);
    setShowEmoji(false);
    setShowGifPicker(true);
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

  const hasContent = text.trim().length > 0 || !!media;

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
          <button className="reply-bar-close" onClick={onCancelReply} aria-label="Cancel reply"><PastelIcon name="close" size={16} /></button>
        </div>
      )}

      {/* Media preview */}
      {media && (
        <div className="media-preview-bar">
          {media.preview ? (
            <img src={media.preview} alt="preview" className="media-preview-img" />
          ) : (
            <div className="media-preview-file">
              <PastelIcon className="media-file-icon" name="file" size={22} title="File attachment" />
              <div className="media-file-info">
                <span className="media-file-name">{media.name}</span>
                <span className="media-file-size">{formatBytes(media.size)}</span>
              </div>
            </div>
          )}
          <button
            className="media-preview-remove"
            onClick={() => setMedia(null)}
            title="Remove"
          ><PastelIcon name="close" size={16} /></button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="emoji-picker">
          {EMOJI_LIST.map((e) => (
            <button key={e} onClick={() => insertEmoji(e)} className="emoji-btn">{e}</button>
          ))}
        </div>
      )}

      {/* GIF / Sticker picker */}
      {showGifPicker && (
        <GifStickerPicker
          keyword={text}
          initialTab={suggestedGifQuery ? 'gifs' : 'stickers'}
          initialSearch={suggestedGifQuery}
          onSelect={handleGifSelect}
          onClose={() => { setShowGifPicker(false); setSuggestedGifQuery(''); }}
        />
      )}

      <SmartSuggestionBar
        message={text}
        onStickerSelect={handleSuggestedSticker}
        onGifQuery={handleSuggestedGif}
      />

      {/* Input row */}
      <div className="input-row">
        {/* Emoji */}
        <button
          className={`icon-btn ${showEmoji ? 'active' : ''}`}
          onClick={() => { setShowEmoji(v => !v); setShowGifPicker(false); }}
          title="Emoji"
          type="button"
        ><PastelIcon name="smile" size={21} /></button>

        {/* GIF / Sticker */}
        <button
          className={`icon-btn gif-icon-btn ${showGifPicker ? 'active' : ''}`}
          onClick={() => { setShowGifPicker(v => !v); setShowEmoji(false); }}
          title="GIFs & Stickers"
          type="button"
          disabled={disabled || sending}
        >
          <span className="gif-btn-label">GIF</span>
        </button>

        {/* File attach */}
        <button
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file or image"
          type="button"
          disabled={disabled || sending}
        ><PastelIcon name="attachment" size={21} /></button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp4,.mp3"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

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
          className={`send-btn ${hasContent ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!hasContent || sending || disabled}
          title="Send"
          type="button"
        >
          <PastelIcon name="send" size={21} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
