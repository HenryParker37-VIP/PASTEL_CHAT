const mongoose = require('mongoose');

const stickerPackSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameVi: { type: String, default: '' },
  description: { type: String, default: '' },
  cover: { type: String, required: true }, // emoji used as cover
  tags: [String],
  isPremium: { type: Boolean, default: false },
  isOfficial: { type: Boolean, default: true },
  downloadCount: { type: Number, default: 0 },
  status: { type: String, enum: ['published', 'draft', 'removed'], default: 'published' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

stickerPackSchema.index({ status: 1, order: 1 });
stickerPackSchema.index({ tags: 1 });

module.exports = mongoose.model('StickerPack', stickerPackSchema);
