// backend/src/models/Setting.js
import mongoose from 'mongoose'

export const Setting = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: Object, default: {} },
  updatedBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }))
