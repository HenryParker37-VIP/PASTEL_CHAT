import React from 'react';
import { getPastelIdentity } from '../utils/pastelIdentity';
import { resolveCharacterAvatar } from '../utils/characterAvatar';

const TypingIndicator = ({ typingUsers = [], aiTyping = null, friend = null, messages = [], conversationIdentity = null }) => {
  const isAiTyping = Boolean(aiTyping && aiTyping.isTyping);
  const hasHumanTyping = Array.isArray(typingUsers) && typingUsers.length > 0;

  if (!isAiTyping && !hasHumanTyping) return null;

  // If AI is typing, render the authentic incoming message bubble for Lyra / AI
  if (isAiTyping) {
    const targetUser = aiTyping.user || friend || { name: 'Lyra', avatar: null, _id: 'user_ai_lyra' };
    const identity = aiTyping.identity || conversationIdentity || getPastelIdentity(targetUser._id || 'user_ai_lyra');
    const senderName = targetUser.name || 'Lyra';
    const senderAvatar = resolveCharacterAvatar({
      friend: targetUser || friend,
      messages,
      friendId: targetUser._id || friend?._id || 'user_ai_lyra'
    });
    const accentColor = identity?.accent || '#E8A0D0';
    const softColor = identity?.soft || '#FBF0F8';

    return (
      <div
        className="msg-row you typing-bubble-row"
        data-testid="ai-typing-indicator"
        style={{
          minHeight: 44,
          animation: 'fadeIn 0.22s ease-out',
          marginBottom: 4
        }}
      >
        {/* Avatar aligned to bottom of incoming row */}
        <div style={{ width: 32, flexShrink: 0, alignSelf: 'flex-end', marginRight: 8 }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'block',
                border: `2px solid ${accentColor}`,
                objectFit: 'cover'
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: softColor,
                border: `2px solid ${accentColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: accentColor,
                fontWeight: 700
              }}
            >
              {senderName[0]?.toUpperCase() || 'L'}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            maxWidth: '72%',
            position: 'relative'
          }}
        >
          {/* Sender label */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: accentColor,
              marginLeft: 4,
              marginBottom: 2
            }}
          >
            {senderName}
          </span>

          {/* Incoming message bubble with bouncing pastel dots */}
          <div
            className="msg-bubble-v2 theirs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '11px 16px',
              minHeight: 38,
              minWidth: 54
            }}
            aria-live="polite"
            aria-label={`${senderName} is typing`}
          >
            <div className="loading-dots" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <span className="d" />
              <span className="d" />
              <span className="d" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for human peer typing
  const names = typingUsers.map((u) => u.name).join(', ');
  const label = typingUsers.length === 1 ? `${names} is typing` : `${names} are typing`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px 4px',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      <div className="loading-dots" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <span className="d" style={{ width: 6, height: 6 }} />
        <span className="d" style={{ width: 6, height: 6 }} />
        <span className="d" style={{ width: 6, height: 6 }} />
      </div>
      <span
        style={{
          fontSize: '12px',
          color: '#AAAAAA',
          fontStyle: 'italic'
        }}
      >
        {label}...
      </span>
    </div>
  );
};

export default TypingIndicator;
