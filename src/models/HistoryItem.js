// backend/src/models/HistoryItem.js
import mongoose from 'mongoose'

export const HistoryItem = mongoose.model('HistoryItem', new mongoose.Schema({
  category: { type: String, enum: ['history', 'bhamashah'], default: 'history' },
  year: { type: String },
  order: { type: Number, default: 0 },
  titleEn: { type: String, required: true },
  titleHi: { type: String },
  bodyEn: String,
  bodyHi: String,
  imageUrl: String,
  published: { type: Boolean, default: false },
  publishedAt: Date,
  createdBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }))
