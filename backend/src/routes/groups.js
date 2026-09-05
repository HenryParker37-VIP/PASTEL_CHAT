const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createGroup, findGroup, getGroupsForUser, groupPublic,
  addGroupMember, removeGroupMember, updateGroup, getGroupConversation,
  createMessage, findMessageByClientMessageId, populateMessage, findUserById, findMessage, updateMessage, toggleReaction
} = require('../db/store');
const { notifyInApp } = require('../services/inAppNotifications');

// GET /groups — list groups I belong to
router.get('/', authMiddleware, (req, res) => {
  const list = getGroupsForUser(req.user._id) || [];
  const groups = list.map(groupPublic).filter(Boolean);
  res.json(groups);
});

// POST /groups — create group { name, memberIds }
router.post('/', authMiddleware, (req, res) => {
  const { name, memberIds = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Group name required' });
  if (!Array.isArray(memberIds)) return res.status(400).json({ message: 'memberIds must be array' });

  const validMemberIds = [...new Set(memberIds.map(String).filter((id) => findUserById(id)))].slice(0, 50);
  const group = createGroup({ name, creatorId: req.user._id, memberIds: validMemberIds });
  const pub = groupPublic(group);

  const io = req.app.get('io');
  pub.members.forEach(m => {
    notifyInApp(io, m._id, {
      type: 'group_created',
      group: pub,
      from: { _id: req.user._id, name: req.user.name }
    }, {
      title: 'Bạn đã được thêm vào nhóm',
      body: `Nhóm “${pub.name}” đã được tạo.`,
      data: { route: `/group/${pub._id}` }
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
  notifyInApp(io, userId, { type: 'group_invited', group: pub, from: { _id: req.user._id, name: req.user.name } }, {
    title: 'Bạn được mời vào nhóm',
    body: `${req.user.name} đã mời bạn vào nhóm “${pub.name}”.`,
    data: { route: `/group/${pub._id}` }
  });
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
  const msgs = getGroupConversation(group._id, { limit: Math.min(Number(limit) || 100, 500), before, viewerId: req.user._id });
  res.json(msgs);
});

// POST /groups/:id/messages — send message { content, media }
router.post('/:id/messages', authMiddleware, (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) return res.status(404).json({ message: 'Not found' });
  if (!group.members.includes(req.user._id)) return res.status(403).json({ message: 'Not a member' });

  const { content, media, clientMessageId } = req.body;
  if ((!content || !content.trim()) && !media) return res.status(400).json({ message: 'Content or media required' });
  if (clientMessageId) {
    const existing = findMessageByClientMessageId(req.user._id, String(clientMessageId).slice(0, 120));
    if (existing && existing.groupId === group._id) return res.status(200).json(populateMessage(existing, req.user._id));
  }

  let validMedia = null;
  if (media?.type === 'sticker' && media?.imageUrl) {
    validMedia = {
      type: 'sticker',
      stickerId: media.stickerId ? String(media.stickerId).slice(0, 100) : null,
      imageUrl: String(media.imageUrl).slice(0, 2000),
      name: media.name ? String(media.name).slice(0, 200) : 'Sticker'
    };
  } else if (media?.type === 'gif' && media?.url) {
    validMedia = {
      type: 'gif',
      url: String(media.url).slice(0, 2000),
      preview: media.previewUrl || media.preview ? String(media.previewUrl || media.preview).slice(0, 2000) : null,
      previewUrl: media.previewUrl || media.preview ? String(media.previewUrl || media.preview).slice(0, 2000) : null,
      name: media.name ? String(media.name).slice(0, 200) : 'GIF'
    };
  } else if (media?.dataUrl && media?.name) {
    const sizeBytes = Math.round((media.dataUrl.length * 3) / 4);
    if (sizeBytes > 8 * 1024 * 1024) return res.status(400).json({ message: 'File too large' });
    validMedia = { type: media.type === 'image' ? 'image' : 'file', dataUrl: media.dataUrl, name: String(media.name).slice(0, 200), size: sizeBytes };
  }

  const msg = createMessage({
    senderId: req.user._id,
    receiverId: null,
    groupId: group._id,
    clientMessageId: clientMessageId ? String(clientMessageId).slice(0, 120) : null,
    content: (content || '').trim().slice(0, 2000),
    media: validMedia
  });
  const populated = populateMessage(msg, req.user._id);

  const io = req.app.get('io');
  // emit to all group members
  group.members.forEach(memberId => {
    io.emit(`msg:group:${group._id}:${memberId}`, populated);
    if (memberId !== req.user._id) {
      notifyInApp(io, memberId, {
        type: 'group_message',
        groupId: group._id,
        groupName: group.name,
        from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
        preview: (populated.content || '📎 Media').slice(0, 80)
      }, {
        title: group.name,
        body: `${req.user.name}: ${(populated.content || 'Có tệp đính kèm').slice(0, 80)}`,
        data: { route: `/group/${group._id}` }
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
  if (msg.groupId !== group._id) return res.status(403).json({ message: 'Message is not in this group' });
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
  if (msg.groupId !== group._id) return res.status(403).json({ message: 'Message is not in this group' });
  const updated = toggleReaction(msg._id, req.user._id, emoji);
  const populated = populateMessage(updated);
  const io = req.app.get('io');
  group.members.forEach(memberId => {
    io.emit(`msg_reaction:group:${group._id}:${memberId}`, { messageId: msg._id, reactions: populated.reactions });
  });
  res.json({ messageId: msg._id, reactions: populated.reactions });
});

module.exports = router;
