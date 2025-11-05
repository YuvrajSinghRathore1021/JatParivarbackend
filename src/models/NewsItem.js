// backend/src/models/NewsItem.js
import mongoose from 'mongoose'

export const NewsItem = mongoose.model('NewsItem', new mongoose.Schema({
  slug: { type: String, unique: true },
  titleEn: { type: String, required: true },
  titleHi: { type: String },
  excerptEn: String,
  excerptHi: String,
  bodyEn: String,
  bodyHi: String,
  heroImageUrl: String,
  published: { type: Boolean, default: false },
  publishedAt: Date,
  createdBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }))
