import React, { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import LoadingAnimation from './LoadingAnimation';
import TypingIndicator from './TypingIndicator';

const MessageList = ({ messages, loading, typingUsers, onReply, onRecall }) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers]);

  const groupByDate = (msgs) => {
    const groups = [];
    let lastDate = null;
    msgs.forEach((msg) => {
      const d = new Date(msg.timestamp).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      if (d !== lastDate) {
        groups.push({ type: 'dateSeparator', label: d, id: `sep-${d}` });
        lastDate = d;
      }
      groups.push({ type: 'message', data: msg, id: msg._id });
    });
    return groups;
  };

  const items = groupByDate(messages);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFF8F3'
      }}
    >
      {loading && <LoadingAnimation />}

      {!loading && messages.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: '#CCCCCC'
        }}>
          <div style={{ fontSize: '48px' }}>💬</div>
          <p style={{ fontSize: '15px', fontWeight: 500 }}>No messages yet</p>
          <p style={{ fontSize: '13px' }}>Be the first to say hello!</p>
        </div>
      )}

      {!loading && items.map((item) => {
        if (item.type === 'dateSeparator') {
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 24px',
                userSelect: 'none'
              }}
            >
              <div style={{ flex: 1, height: '1px', background: '#EEE0D8' }} />
              <span style={{
                fontSize: '11px',
                color: '#BBBBBB',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                {item.label}
              </span>
              <div style={{ flex: 1, height: '1px', background: '#EEE0D8' }} />
            </div>
          );
        }
        return (
          <MessageItem
            key={item.id}
            message={item.data}
            onReply={onReply}
            onRecall={onRecall}
          />
        );
      })}

      <TypingIndicator typingUsers={typingUsers} />

      <div ref={bottomRef} style={{ height: '4px' }} />
    </div>
  );
};

export default MessageList;
