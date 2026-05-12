const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  googleId: {
    type: String,
    sparse: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  telegramChatId: {
    type: String,
    sparse: true
  },
  telegramUsername: {
    type: String,
    sparse: true
  },
  telegramConnected: {
    type: Boolean,
    default: false
  },
  telegramVerified: {
    type: Boolean,
    default: false
  },
  telegramVerificationCode: {
    type: String,
    sparse: true
  },
  telegramVerificationExpires: {
    type: Date,
    sparse: true
  },
  notificationPreferences: {
    enableTelegramNotifications: {
      type: Boolean,
      default: true
    },
    enableTelegramCalls: {
      type: Boolean,
      default: true
    },
    enableTelegramMessages: {
      type: Boolean,
      default: true
    }
  }
});

module.exports = mongoose.model('User', userSchema);
