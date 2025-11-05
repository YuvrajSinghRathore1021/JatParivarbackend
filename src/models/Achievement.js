// backend/src/models/Achievement.js
import mongoose from 'mongoose'

export const Achievement = mongoose.model('Achievement', new mongoose.Schema({
  textEn: { type: String, required: true },
  textHi: { type: String },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true }))
