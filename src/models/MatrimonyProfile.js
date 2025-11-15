// backend/src/models/MatrimonyProfile.js
import mongoose from 'mongoose'
export const MatrimonyProfile = mongoose.model('MatrimonyProfile', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', unique: true,sparse: true  },
  visible: { type: Boolean, default: true },
  age: Number,
  gender: String,
  height: String,
  maritalStatus: String,
  education: String,
  occupation: String,
  state: String, district: String, city: String, village: String,
  gotra: { self: String, mother: String, nani: String, dadi: String },
  photos: [String],
}, { timestamps: true }))
