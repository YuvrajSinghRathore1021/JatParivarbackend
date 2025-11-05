// backend/src/models/AdCampaign.js
import mongoose from 'mongoose'

export const AdCampaign = mongoose.model('AdCampaign', new mongoose.Schema({
  label: String,
  titleEn: String,
  titleHi: String,
  descriptionEn: String,
  descriptionHi: String,
  href: String,
  imageUrl: String,
  variant: { type: String, enum: ['billboard', 'rail', 'inline'], default: 'billboard' },
  active: { type: Boolean, default: false },
  startsAt: Date,
  endsAt: Date
}, { timestamps: true }))
