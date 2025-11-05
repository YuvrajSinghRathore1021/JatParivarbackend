// backend/src/models/JobPost.js
import mongoose from 'mongoose'
export const JobPost = mongoose.model('JobPost', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  title: String,
  description: String,
  locationState: String,
  locationDistrict: String,
  locationCity: String,
  type: String,
  salaryRange: String,
  contactPhone: String,
  approved: { type: Boolean, default: false },
}, { timestamps: true }))
