// backend/src/models/Page.js
import mongoose from 'mongoose'

const pageSchema = new mongoose.Schema({
  slug: { type: String, unique: true },
  titleEn: String,
  titleHi: String,
  contentEn: { type: Object, default: {} },
  contentHi: { type: Object, default: {} },
  status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft' },
  scheduledAt: Date,
  publishedAt: Date,
  updatedBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true })

export const Page = mongoose.model('Page', pageSchema)
