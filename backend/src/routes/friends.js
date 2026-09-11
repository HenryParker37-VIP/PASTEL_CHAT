const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { sendFriendRequestPush } = require('../services/pushService');
const { notifyInApp } = require('../services/inAppNotifications');
const {
  getFriends,
  addFriend,
  updateFriend,
  removeFriend,
  findUserById,
  createRequest,
  getRequests,
  findRequestById,
  findRequest,
  findFriendship,
  removeRequest
} = require('../db/store');

// GET /friends - List my friends
router.get('/', authMiddleware, (req, res) => {
  res.json(getFriends(req.user._id) || []);
});

// GET /friends/requests - List pending requests
router.get('/requests', authMiddleware, (req, res) => {
  res.json(getRequests(req.user._id) || []);
});

// POST /friends/request - Send a friend request { friendId }
router.post('/request', authMiddleware, (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ message: 'friendId required' });
    if (String(friendId) === String(req.user._id)) return res.status(400).json({ message: 'Cannot add yourself' });
    
    const target = findUserById(friendId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    const reqObj = createRequest(req.user._id, friendId);
    if (!reqObj) return res.status(400).json({ message: 'Request could not be created or already friends' });

    const io = req.app.get('io');
    if (reqObj.autoAccepted) {
      try {
        notifyInApp(io, friendId, {
          type: 'friend_accepted',
          from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar }
        }, {
          title: 'Đã trở thành bạn bè',
          body: `${req.user.name} và bạn đã trở thành bạn bè.`,
          data: { route: '/friends' }
        });
      } catch (e) {}
      return res.json(reqObj);
    }

    // Notify the target
    try {
      notifyInApp(io, friendId, {
        type: 'friend_requested',
        from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar }
      }, {
        title: 'Lời mời kết bạn mới',
        body: `${req.user.name} muốn kết bạn với bạn.`,
        data: { route: '/friends' }
      });
    } catch (e) {}

    // Send Web Push notification
    sendFriendRequestPush(friendId, req.user).catch(e =>
      console.error('[Push] Failed to send friend request push:', e.message)
    );

    res.json(reqObj);
  } catch (error) {
    console.error('[Friends] Request error:', error.message);
    res.status(500).json({ message: 'Failed to send friend request' });
  }
});

// POST /friends/accept/:reqId - Accept a request
router.post('/accept/:reqId', authMiddleware, (req, res) => {
  try {
    const rawReqId = String(req.params.reqId || '').trim();
    const myId = String(req.user._id);

    let request = findRequestById(rawReqId) || findRequest(rawReqId, myId);
    if (!request) {
      const existing = findFriendship(myId, rawReqId) || findFriendship(rawReqId, myId);
      if (existing) {
        return res.json({ success: true, message: 'Already friends' });
      }
      return res.status(404).json({ message: 'Friend request not found or already accepted' });
    }

    if (String(request.toId) !== myId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Become mutual friends
    const fromId = String(request.fromId);
    const toId = String(request.toId);
    const A = findUserById(fromId);
    const B = findUserById(toId) || req.user;

    const fromName = A?.name || 'Friend';
    const toName = B?.name || req.user.name || 'Friend';

    addFriend(fromId, toId, toName);
    addFriend(toId, fromId, fromName);

    removeRequest(request._id, fromId);

    // Notify sender safely
    try {
      const io = req.app.get('io');
      const senderFrom = {
        _id: toId,
        name: toName,
        avatar: B?.avatar || req.user.avatar || ''
      };
      notifyInApp(io, fromId, {
        type: 'friend_accepted',
        from: senderFrom
      }, {
        title: 'Lời mời kết bạn đã được chấp nhận',
        body: `${toName} đã trở thành bạn bè với bạn.`,
        data: { route: '/friends' }
      });
    } catch (e) {
      console.warn('[Friends] Failed to emit accept notification:', e.message);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[Friends] Accept error:', error.message);
    return res.status(500).json({ message: 'Failed to accept friend request' });
  }
});

// POST /friends/decline/:reqId - Decline a request
router.post('/decline/:reqId', authMiddleware, (req, res) => {
  try {
    const rawReqId = String(req.params.reqId || '').trim();
    const myId = String(req.user._id);

    const request = findRequestById(rawReqId) || findRequest(rawReqId, myId);
    if (!request) return res.json({ success: true, message: 'Request already cleared' });
    if (String(request.toId) !== myId) return res.status(403).json({ message: 'Not authorized' });

    removeRequest(request._id, request.fromId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Friends] Decline error:', error.message);
    return res.status(500).json({ message: 'Failed to decline friend request' });
  }
});

// PUT /friends/:friendId - Update custom nickname for a friend
router.put('/:friendId', authMiddleware, (req, res) => {
  const { customNickname } = req.body;
  if (!customNickname || !customNickname.trim()) return res.status(400).json({ message: 'Nickname required' });
  const f = updateFriend(req.user._id, req.params.friendId, customNickname);
  if (!f) return res.status(404).json({ message: 'Friendship not found' });
  res.json(f);
});

// DELETE /friends/:friendId - Remove a friend
router.delete('/:friendId', authMiddleware, (req, res) => {
  const ok = removeFriend(req.user._id, req.params.friendId);
  removeFriend(req.params.friendId, req.user._id); // Also remove reverse friendship
  if (!ok) return res.status(404).json({ message: 'Friendship not found' });
  res.json({ success: true });
});

module.exports = router;
