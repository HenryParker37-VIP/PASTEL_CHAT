const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { notifyNewMessage, notifySticker, notifyGif } = require('../integrations/notificationManager');
const {
  createMessage,
  updateMessage,
  findMessage,
  getConversation,
  getPinnedMessages,
  searchMessages,
  clearConversation,
  populateMessage,
  toggleReaction,
  findUserById
} = require('../db/store');

// GET /messages/with/:friendId - Fetch 1-on-1 conversation
router.get('/with/:friendId', authMiddleware, (req, res) => {
  try {
    const { limit = 100, before } = req.query;
    const msgs = getConversation(req.user._id, req.params.friendId, {
      limit: Math.min(Number(limit) || 100, 500),
      before: before || null
    });
    res.json(msgs);
  } catch (e) {
    console.error('[Messages] Conversation error:', e.message);
    res.status(500).json({ message: 'Failed to load conversation' });
  }
});

// GET /messages/pinned/:friendId
router.get('/pinned/:friendId', authMiddleware, (req, res) => {
  res.json(getPinnedMessages(req.user._id, req.params.friendId));
});

// GET /messages/search/:friendId?q=xxx
router.get('/search/:friendId', authMiddleware, (req, res) => {
  const query = req.query.q || '';
  res.json(searchMessages(req.user._id, req.params.friendId, query));
});

// DELETE /messages/clear/:friendId - Clear whole conversation
router.delete('/clear/:friendId', authMiddleware, (req, res) => {
  const count = clearConversation(req.user._id, req.params.friendId);
  const io = req.app.get('io');
  io.emit(`notify:${req.params.friendId}`, {
    type: 'chat_cleared',
    from: { _id: req.user._id, name: req.user.name }
  });
  res.json({ success: true, cleared: count });
});

// POST /messages - Send new message { receiverId, content, replyTo, media }
router.post('/', authMiddleware, (req, res) => {
  try {
    const { receiverId, content, replyTo, media } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'receiverId required' });
    // Allow empty content if media is present
    if ((!content || !content.trim()) && !media) return res.status(400).json({ message: 'Content or media required' });
    const receiver = findUserById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    // Validate media object
    let validMedia = null;
    if (media) {
      // Sticker with imageUrl (new format)
      if (media.type === 'sticker' && media.imageUrl) {
        validMedia = {
          type: 'sticker',
          emoji: media.emoji ? String(media.emoji).slice(0, 10) : '📌',
          imageUrl: String(media.imageUrl).slice(0, 2000),
          name: media.name ? String(media.name).slice(0, 200) : 'Sticker'
        };
      }
      // GIF with URL (new format)
      else if (media.type === 'gif' && media.url) {
        validMedia = {
          type: 'gif',
          url: String(media.url).slice(0, 2000),
          preview: media.preview ? String(media.preview).slice(0, 2000) : null,
          name: media.name ? String(media.name).slice(0, 200) : 'GIF',
          duration: media.duration || null
        };
      }
      // Legacy format (base64 dataUrl) - keep for backward compatibility
      else if (media.dataUrl && media.name) {
        const sizeBytes = Math.round((media.dataUrl.length * 3) / 4);
        if (sizeBytes > 8 * 1024 * 1024) return res.status(400).json({ message: 'File too large (max 8MB)' });
        validMedia = {
          type: media.type === 'image' ? 'image' : 'file',
          dataUrl: media.dataUrl,
          name: String(media.name).slice(0, 200),
          size: sizeBytes
        };
      }
    }

    const msg = createMessage({
      senderId: req.user._id,
      receiverId,
      content: (content || '').trim().slice(0, 2000),
      replyTo: replyTo || null,
      media: validMedia
    });
    const populated = populateMessage(msg);

    const io = req.app.get('io');
    // Emit to both participants only
    io.emit(`msg:${req.user._id}:${receiverId}`, populated);
    io.emit(`msg:${receiverId}:${req.user._id}`, populated);
    // Also notify receiver for toast
    io.emit(`notify:${receiverId}`, {
      type: 'new_message',
      from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      preview: populated.content.slice(0, 80),
      messageId: populated._id
    });

    // Send Telegram notification if applicable
    if (validMedia?.type === 'sticker') {
      notifySticker(receiverId, req.user, validMedia.name).catch(e =>
        console.error('[Telegram] Failed to send sticker notification:', e.message)
      );
    } else if (validMedia?.type === 'gif') {
      notifyGif(receiverId, req.user, validMedia.name).catch(e =>
        console.error('[Telegram] Failed to send GIF notification:', e.message)
      );
    } else if (content && content.trim()) {
      notifyNewMessage(receiverId, req.user, content).catch(e =>
        console.error('[Telegram] Failed to send message notification:', e.message)
      );
    }

    res.status(201).json(populated);
  } catch (e) {
    console.error('[Messages] Send error:', e.message);
    res.status(500).json({ message: 'Failed to send' });
  }
});

// DELETE /messages/:id - Recall
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const msg = findMessage(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Not found' });
    if (String(msg.senderId) !== String(req.user._id))
      return res.status(403).json({ message: 'Can only recall your own messages' });

    updateMessage(msg._id, { isRecalled: true, content: 'This message has been recalled' });
    const io = req.app.get('io');
    io.emit(`msg_recall:${msg.senderId}:${msg.receiverId}`, { messageId: msg._id });
    io.emit(`msg_recall:${msg.receiverId}:${msg.senderId}`, { messageId: msg._id });
    res.json({ success: true, messageId: msg._id });
  } catch (e) {
    res.status(500).json({ message: 'Failed to recall' });
  }
});

// POST /messages/:id/pin - Toggle pin
router.post('/:id/pin', authMiddleware, (req, res) => {
  const msg = findMessage(req.params.id);
  if (!msg) return res.status(404).json({ message: 'Not found' });
  if (msg.isRecalled) return res.status(400).json({ message: 'Cannot pin recalled' });
  // Only participants can pin
  if (msg.senderId !== req.user._id && msg.receiverId !== req.user._id)
    return res.status(403).json({ message: 'Not a participant' });

  const updated = updateMessage(msg._id, { isPinned: !msg.isPinned });
  const populated = populateMessage(updated);
  const io = req.app.get('io');
  io.emit(`msg_pin:${msg.senderId}:${msg.receiverId}`, populated);
  io.emit(`msg_pin:${msg.receiverId}:${msg.senderId}`, populated);
  res.json(populated);
});

// POST /messages/:id/react - Toggle reaction { emoji }
router.post('/:id/react', authMiddleware, (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'emoji required' });
    const ALLOWED = ['👍','❤️','😂','😮','😢','😡'];
    if (!ALLOWED.includes(emoji)) return res.status(400).json({ message: 'Invalid emoji' });

    const msg = findMessage(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Not found' });
    if (msg.isRecalled) return res.status(400).json({ message: 'Cannot react to recalled' });
    if (msg.senderId !== req.user._id && msg.receiverId !== req.user._id)
      return res.status(403).json({ message: 'Not a participant' });

    const updated = toggleReaction(msg._id, req.user._id, emoji);
    const populated = populateMessage(updated);
    const io = req.app.get('io');
    io.emit(`msg_reaction:${msg.senderId}:${msg.receiverId}`, { messageId: msg._id, reactions: populated.reactions });
    io.emit(`msg_reaction:${msg.receiverId}:${msg.senderId}`, { messageId: msg._id, reactions: populated.reactions });
    res.json({ messageId: msg._id, reactions: populated.reactions });
  } catch (e) {
    res.status(500).json({ message: 'Failed to react' });
  }
});

// POST /messages/:id/reply - Reply { content }
router.post('/:id/reply', authMiddleware, (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Content required' });
    const original = findMessage(req.params.id);
    if (!original) return res.status(404).json({ message: 'Original not found' });
    if (original.isRecalled) return res.status(400).json({ message: 'Cannot reply to recalled' });

    // Reply goes to the OTHER participant in the original conversation
    const otherId = original.senderId === req.user._id ? original.receiverId : original.senderId;
    const msg = createMessage({
      senderId: req.user._id,
      receiverId: otherId,
      content: content.trim().slice(0, 2000),
      replyTo: original._id
    });
    const populated = populateMessage(msg);
    const io = req.app.get('io');
    io.emit(`msg:${req.user._id}:${otherId}`, populated);
    io.emit(`msg:${otherId}:${req.user._id}`, populated);
    io.emit(`notify:${otherId}`, {
      type: 'new_message',
      from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      preview: populated.content.slice(0, 80),
      messageId: populated._id
    });
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: 'Failed to reply' });
  }
});

module.exports = router;
