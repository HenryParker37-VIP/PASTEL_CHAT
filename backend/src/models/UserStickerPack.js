const mongoose = require('mongoose');

const userStickerPackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  packId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack', required: true },
  addedAt: { type: Date, default: Date.now },
  isPinned: { type: Boolean, default: false },
}, { timestamps: false });

userStickerPackSchema.index({ userId: 1, addedAt: -1 });
userStickerPackSchema.index({ userId: 1, packId: 1 }, { unique: true });

module.exports = mongoose.model('UserStickerPack', userStickerPackSchema);
