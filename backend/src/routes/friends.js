const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getFriends,
  addFriend,
  updateFriend,
  removeFriend,
  findUserById,
  createRequest,
  getRequests,
  findRequestById,
  removeRequest
} = require('../db/store');

// GET /friends - List my friends
router.get('/', authMiddleware, (req, res) => {
  res.json(getFriends(req.user._id));
});

// GET /friends/requests - List pending requests
router.get('/requests', authMiddleware, (req, res) => {
  res.json(getRequests(req.user._id));
});

// POST /friends/request - Send a friend request { friendId }
router.post('/request', authMiddleware, (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ message: 'friendId required' });
  if (friendId === req.user._id) return res.status(400).json({ message: 'Cannot add yourself' });
  
  const target = findUserById(friendId);
  if (!target) return res.status(404).json({ message: 'User not found' });

  const reqObj = createRequest(req.user._id, friendId);
  if (!reqObj) return res.status(400).json({ message: 'Request could not be created or already friends' });

  // Notify the target
  const io = req.app.get('io');
  io.emit(`notify:${friendId}`, {
    type: 'friend_requested',
    from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar }
  });

  res.json(reqObj);
});

// POST /friends/accept/:reqId - Accept a request
router.post('/accept/:reqId', authMiddleware, (req, res) => {
  const request = findRequestById(req.params.reqId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.toId !== req.user._id) return res.status(403).json({ message: 'Not authorized' });

  // Become mutual friends
  const A = findUserById(request.fromId);
  const B = findUserById(request.toId);
  if (A && B) {
    addFriend(A._id, B._id, B.name);
    addFriend(B._id, A._id, A.name);
  }

  removeRequest(request._id);

  // Notify sender
  const io = req.app.get('io');
  io.emit(`notify:${request.fromId}`, {
    type: 'friend_accepted',
    from: { _id: B._id, name: B.name, avatar: B.avatar }
  });

  res.json({ success: true });
});

// POST /friends/decline/:reqId - Decline a request
router.post('/decline/:reqId', authMiddleware, (req, res) => {
  const request = findRequestById(req.params.reqId);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.toId !== req.user._id) return res.status(403).json({ message: 'Not authorized' });

  removeRequest(request._id);
  res.json({ success: true });
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
