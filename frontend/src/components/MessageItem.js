import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import GifMessage from './GifMessage';
import StickerDisplay from './StickerDisplay';
import PastelIcon from './PastelIcon';
import { useConfirm, useToast } from './Toast';
import { useLang } from '../i18n';
import { getPastelColor, getPastelIdentity } from '../utils/pastelIdentity';

const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
const isEmojiOnly = (text) => {
  const stripped = (text || '').replace(/\s/g, '');
  const cleaned = stripped.replace(emojiRegex, '');
  return cleaned.length === 0 && stripped.length > 0;
};

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MessageItem = ({ message, peer, onReply, onRecall, onPin, onReaction, onRetry, highlight, conversationIdentity }) => {
  const { user } = useAuth();
  const { t } = useLang();
  const { push } = useToast();
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isOwn = (message.senderId?._id || message.senderId) === user?._id;
  const sender = typeof message.senderId === 'object' ? message.senderId : null;
  const senderName = isOwn ? 'You' : (peer?.customNickname || sender?.name || 'Friend');
  const senderAvatar = sender?.avatar;
  const senderIdentity = getPastelIdentity(sender?._id || message.senderId);
  const bubbleIdentity = isOwn
    ? (conversationIdentity || getPastelColor(user?.chatColor) || getPastelIdentity(user?._id))
    : (getPastelColor(peer?.chatColor) || senderIdentity);

  const replyRef = message.replyTo;
  const emojiOnly = !message.isRecalled && isEmojiOnly(message.content);
  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;
  const deliveryStatus = message.deliveryStatus || 'sent';

  const handleRecall = async () => {
    const accepted = await confirm({ title: t('chatRecall'), message: t('chatRecallConfirm'), confirmLabel: t('chatRecall'), tone: 'danger', icon: 'trash' });
    if (!accepted) return;
    setBusy(true);
    try {
      await api.delete(`/messages/${message._id}`);
      onRecall?.(message._id);
      push({ icon: 'check', title: t('feedbackMessageRecalled'), tone: 'success' });
    } catch (err) {
      push({ icon: 'alert', title: t('feedbackSomethingWrong'), body: err.response?.data?.message, tone: 'error' });
    } finally { setBusy(false); }
  };

  const handlePin = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/messages/${message._id}/pin`);
      onPin?.(data);
      push({ icon: 'pin', title: t('feedbackMessagePinned'), tone: 'success' });
    } catch (err) {
      push({ icon: 'alert', title: t('feedbackSomethingWrong'), body: err.response?.data?.message, tone: 'error' });
    } finally { setBusy(false); }
  };

  const handleReact = async (emoji) => {
    setShowReactionPicker(false);
    try {
      const { data } = await api.post(`/messages/${message._id}/react`, { emoji });
      onReaction?.(message._id, data.reactions);
    } catch (err) {
      console.error('Reaction failed:', err);
    }
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
      onMouseLeave={() => { setShowActions(false); setShowReactionPicker(false); }}
    >
      {/* Avatar — only for received messages */}
      {!isOwn && (
        <div style={{ width: 32, flexShrink: 0, alignSelf: 'flex-end', marginRight: 8 }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              style={{ width: 32, height: 32, borderRadius: '50%', display: 'block', border: `2px solid ${senderIdentity.accent}` }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: senderIdentity.soft,
              border: `2px solid ${senderIdentity.accent}`,
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
          <span style={{ fontSize: 11, fontWeight: 600, color: senderIdentity.accent, marginLeft: 4, marginBottom: 2 }}>
            {senderName}
          </span>
        )}

        {/* Bubble */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
          <div
            className={`msg-bubble-v2 ${isOwn ? 'own' : 'theirs'} ${emojiOnly ? 'emoji-only' : ''} ${message.isRecalled ? 'recalled' : ''}`}
            style={!message.isRecalled && !emojiOnly ? {
              background: isOwn ? bubbleIdentity.bubble : undefined,
              color: isOwn ? bubbleIdentity.text : undefined,
              boxShadow: isOwn ? `0 2px 12px ${bubbleIdentity.accent}55` : undefined
            } : undefined}
          >
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

            {/* Sticker (illustrated) */}
            {message.media?.type === 'sticker' && !message.isRecalled && (
              <div className="native-sticker-message">
                <StickerDisplay
                  emoji={message.media.emoji}
                  imageUrl={message.media.imageUrl}
                  label={message.media.name}
                  size="large"
                  allowEmojiFallback={false}
                />
              </div>
            )}

            {/* GIF / Sticker */}
            {message.media?.type === 'gif' && !message.isRecalled && (
              <div className="bubble-gif">
                <GifMessage
                  url={message.media.url || message.media.dataUrl}
                  preview={message.media.preview}
                  previewUrl={message.media.previewUrl}
                  width={message.media.width}
                  height={message.media.height}
                  title={message.media.name || 'GIF'}
                />
              </div>
            )}

            {/* Media attachment */}
            {message.media && !['gif', 'sticker'].includes(message.media.type) && !message.isRecalled && (
              message.media.type === 'image' ? (
                <div className="bubble-media-img">
                  <img
                    src={message.media.dataUrl}
                    alt={message.media.name || 'image'}
                    style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, display: 'block', cursor: 'pointer' }}
                    onClick={() => window.open(message.media.dataUrl, '_blank')}
                  />
                </div>
              ) : (
                <a
                  href={message.media.dataUrl}
                  download={message.media.name}
                  className="bubble-media-file"
                >
                  <PastelIcon name="file" size={22} title="File attachment" />
                  <div style={{ minWidth: 0 }}>
                    <div className="bubble-file-name">{message.media.name}</div>
                    <div className="bubble-file-size">{formatBytes(message.media.size)}</div>
                  </div>
                  <PastelIcon name="arrow-down" size={16} className="muted-icon" title="Download file" />
                </a>
              )
            )}

            {/* Message text */}
            {message.content && <div className="bubble-text">{message.content}</div>}

            {/* Time + pin */}
            {!emojiOnly && (
              <div className="bubble-meta">
                {message.isPinned && <PastelIcon name="pin" size={12} title="Pinned" />}
                <span>{formatTime(message.timestamp)}</span>
              </div>
            )}
          </div>

          {/* Floating action toolbar — appears on hover */}
          {!message.isRecalled && showActions && (
            <div className={`msg-toolbar ${isOwn ? 'toolbar-left' : 'toolbar-right'}`}>
              {/* Reaction trigger */}
              <button
                title="React"
                onClick={() => setShowReactionPicker(v => !v)}
                style={{ fontSize: 14 }}
              ><PastelIcon name="smile" size={16} title="React" /></button>
              <button title="Reply" onClick={() => onReply?.(message)} disabled={busy}><PastelIcon name="reply" size={16} title="Reply" /></button>
              <button
                title={message.isPinned ? 'Unpin' : 'Pin'}
                onClick={handlePin}
                disabled={busy}
              ><PastelIcon name="pin" size={16} title={message.isPinned ? 'Unpin' : 'Pin'} /></button>
              {isOwn && (
                <button
                  title="Recall"
                  onClick={handleRecall}
                  disabled={busy}
                  style={{ color: '#e57373' }}
                ><PastelIcon name="trash" size={16} title="Recall" /></button>
              )}

              {/* Reaction picker popup */}
              {showReactionPicker && (
                <div className={`reaction-picker ${isOwn ? 'picker-left' : 'picker-right'}`}>
                  {REACTION_EMOJIS.map(emoji => {
                    const myReaction = (reactions[emoji] || []).includes(user._id);
                    return (
                      <button
                        key={emoji}
                        className={`reaction-option ${myReaction ? 'reacted' : ''}`}
                        onClick={() => handleReact(emoji)}
                        title={emoji}
                      >{emoji}</button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reaction pills */}
        {hasReactions && (
          <div className={`reaction-pills ${isOwn ? 'pills-own' : 'pills-theirs'}`}>
            {Object.entries(reactions).map(([emoji, userIds]) => {
              if (!userIds.length) return null;
              const iMine = userIds.includes(user._id);
              return (
                <button
                  key={emoji}
                  className={`reaction-pill ${iMine ? 'mine' : ''}`}
                  onClick={() => handleReact(emoji)}
                  title={iMine ? 'Remove reaction' : `React with ${emoji}`}
                >
                  {emoji} <span>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Time for emoji-only messages */}
        {emojiOnly && (
          <span style={{ fontSize: 10, color: '#BBBBBB', paddingInline: 4 }}>
            {formatTime(message.timestamp)}
          </span>
        )}

        {isOwn && (
          <div className={`message-delivery-status message-delivery-status--${deliveryStatus}`}>
            {deliveryStatus === 'sending' && <span>Sending…</span>}
            {deliveryStatus === 'failed' && (
              <button type="button" onClick={() => onRetry?.(message)}>
                <PastelIcon name="alert" size={11} /> Failed to send · Retry
              </button>
            )}
            {deliveryStatus === 'sent' && <PastelIcon name="check" size={12} title="Sent" />}
            {deliveryStatus === 'delivered' && <><PastelIcon name="check" size={12} title="Delivered" /><PastelIcon name="check" size={12} title="Delivered" /></>}
            {deliveryStatus === 'read' && <><PastelIcon name="check" size={12} title="Read" /><PastelIcon name="check" size={12} title="Read" /></>}
          </div>
        )}
      </div>

      {/* Spacer on own side so bubble doesn't touch edge */}
      {isOwn && <div style={{ width: 8, flexShrink: 0 }} />}
    </div>
  );
};

export default MessageItem;
