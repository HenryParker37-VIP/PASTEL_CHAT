const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  isRecalled: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  media: {
    type: {
      type: String,
      enum: ['gif', 'image', 'file'],
      default: null
    },
    url: String,
    preview: String,
    name: String,
    size: Number,
    duration: Number,
    dataUrl: String
  },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: new Map()
  },
  isPinned: {
    type: Boolean,
    default: false
  }
});

messageSchema.index({ timestamp: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'media.type': 1 });

module.exports = mongoose.model('Message', messageSchema);
