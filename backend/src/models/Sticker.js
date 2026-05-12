const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema({
  packId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack', required: true },
  emoji: { type: String, required: true },
  label: { type: String, default: '' },
  labelVi: { type: String, default: '' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

stickerSchema.index({ packId: 1, order: 1 });

module.exports = mongoose.model('Sticker', stickerSchema);
