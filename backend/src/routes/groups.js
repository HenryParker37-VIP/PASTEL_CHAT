const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createGroup, findGroup, getGroupsForUser, groupPublic,
  addGroupMember, removeGroupMember, updateGroup, getGroupConversation,
  createMessage, populateMessage, findUserById, findMessage, updateMessage, toggleReaction
} = require('../db/store');

// GET /groups — list groups I belong to
router.get('/', authMiddleware, (req, res) => {
  const groups = getGroupsForUser(req.user._id).map(groupPublic);
  res.json(groups);
});

// POST /groups — create group { name, memberIds }
router.post('/', authMiddleware, (req, res) => {
  const { name, memberIds = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Group name required' });
  if (!Array.isArray(memberIds)) return res.status(400).json({ message: 'memberIds must be array' });

  const group = createGroup({ name, creatorId: req.user._id, memberIds });
  const pub = groupPublic(group);

  const io = req.app.get('io');
  pub.members.forEach(m => {
    io.emit(`notify:${m._id}`, {
      type: 'group_created',
      group: pub,
      from: { _id: req.user._id, name: req.user.name }
    });
  });
  res.status(201).json(pub);
});

// GET /groups/:id — group info
router.get('/:id', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Group not found' });
  if (!group.members.includes(req.user._id))
    return res.status(403).json({ message: 'Not a member' });
  res.json(groupPublic(group));
});

// PUT /groups/:id — rename (creator only)
router.put('/:id', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (group.creatorId !== req.user._id) return res.status(403).json({ message: 'Only creator can rename' });
  const updated = updateGroup(group._id, { name: req.body.name });
  res.json(groupPublic(updated));
});

// POST /groups/:id/invite — add member { userId }
router.post('/:id/invite', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (!group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId required' });
  const target = findUserById(userId);
  if (!target) return res.status(404).json({ message: 'User not found' });
  const updated = addGroupMember(group._id, userId);
  const pub = groupPublic(updated);
  const io = req.app.get('io');
  io.emit(`notify:${userId}`, { type: 'group_invited', group: pub, from: { _id: req.user._id, name: req.user.name } });
  io.emit(`group:updated:${group._id}`, pub);
  res.json(pub);
});

// DELETE /groups/:id/leave — leave group
router.delete('/:id/leave', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (!group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });
  removeGroupMember(group._id, req.user._id);
  const io = req.app.get('io');
  io.emit(`group:updated:${group._id}`, groupPublic(findGroup(group._id)));
  res.json({ success: true });
});

// GET /groups/:id/messages — fetch history
router.get('/:id/messages', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (!group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });
  const { limit = 100, before } = req.query;
  const msgs = getGroupConversation(group._id, { limit: Math.min(Number(limit) || 100, 500), before });
  res.json(msgs);
});

// POST /groups/:id/messages — send message { content, media }
router.post('/:id/messages', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (!group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });

  const { content, media } = req.body;
  if ((!content || !content.trim()) && !media) return res.status(400).json({ message: 'Content or media required' });

  let validMedia = null;
  if (media?.dataUrl && media?.name) {
    const sizeBytes = Math.round((media.dataUrl.length * 3) / 4);
    if (sizeBytes > 8 * 1024 * 1024) return res.status(400).json({ message: 'File too large' });
    validMedia = { type: media.type === 'image' ? 'image' : 'file', dataUrl: media.dataUrl, name: String(media.name).slice(0, 200), size: sizeBytes };
  }

  const msg = createMessage({
    senderId: req.user._id,
    receiverId: null,
    groupId: group._id,
    content: (content || '').trim().slice(0, 2000),
    media: validMedia
  });
  const populated = populateMessage(msg);

  const io = req.app.get('io');
  // emit to all group members
  group.members.forEach(memberId => {
    io.emit(`msg:group:${group._id}:${memberId}`, populated);
    if (memberId !== req.user._id) {
      io.emit(`notify:${memberId}`, {
        type: 'group_message',
        groupId: group._id,
        groupName: group.name,
        from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
        preview: (populated.content || '📎 Media').slice(0, 80)
      });
    }
  });
  res.status(201).json(populated);
});

// DELETE /groups/:id/messages/:msgId — recall group message
router.delete('/:id/messages/:msgId', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  const msg = findMessage(req.params.msgId);
  if (!msg) return res.status(404).json({ message: 'Message not found' });
  if (String(msg.senderId) !== String(req.user._id)) return res.status(403).json({ message: 'Not your message' });
  updateMessage(msg._id, { isRecalled: true, content: 'This message has been recalled' });
  const io = req.app.get('io');
  group.members.forEach(memberId => {
    io.emit(`msg_recall:group:${group._id}:${memberId}`, { messageId: msg._id });
  });
  res.json({ success: true, messageId: msg._id });
});

// POST /groups/:id/messages/:msgId/react
router.post('/:id/messages/:msgId/react', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group || !group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });
  const { emoji } = req.body;
  const ALLOWED = ['👍','❤️','😂','😮','😢','😡'];
  if (!ALLOWED.includes(emoji)) return res.status(400).json({ message: 'Invalid emoji' });
  const msg = findMessage(req.params.msgId);
  if (!msg || msg.isRecalled) return res.status(400).json({ message: 'Cannot react' });
  const updated = toggleReaction(msg._id, req.user._id, emoji);
  const populated = populateMessage(updated);
  const io = req.app.get('io');
  group.members.forEach(memberId => {
    io.emit(`msg_reaction:group:${group._id}:${memberId}`, { messageId: msg._id, reactions: populated.reactions });
  });
  res.json({ messageId: msg._id, reactions: populated.reactions });
});

module.exports = router;
