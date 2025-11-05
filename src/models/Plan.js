// backend/src/models/Plan.js
import mongoose from 'mongoose'

export const Plan = mongoose.model('Plan', new mongoose.Schema({
  code: { type: String, unique: true },
  titleEn: { type: String, required: true },
  titleHi: { type: String },
  descriptionEn: String,
  descriptionHi: String,
  price: { type: Number, required: true },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true }))
