const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createMessage,
  updateMessage,
  findMessage,
  getConversation,
  getPinnedMessages,
  searchMessages,
  clearConversation,
  populateMessage,
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

// POST /messages - Send new message { receiverId, content, replyTo }
router.post('/', authMiddleware, (req, res) => {
  try {
    const { receiverId, content, replyTo } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'receiverId required' });
    if (!content || !content.trim()) return res.status(400).json({ message: 'Content required' });
    const receiver = findUserById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    const msg = createMessage({
      senderId: req.user._id,
      receiverId,
      content: content.trim().slice(0, 2000),
      replyTo: replyTo || null
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
