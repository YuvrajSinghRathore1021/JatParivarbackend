// backend/src/models/PageVersion.js
import mongoose from 'mongoose'

export const PageVersion = mongoose.model('PageVersion', new mongoose.Schema({
  pageId: { type: mongoose.Types.ObjectId, ref: 'Page' },
  version: Number,
  titleEn: String,
  titleHi: String,
  contentEn: { type: Object, default: {} },
  contentHi: { type: Object, default: {} },
  summary: String,
  published: { type: Boolean, default: false },
  publishedAt: Date,
  createdBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }))
