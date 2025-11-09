// backend/src/models/Person.js
import mongoose from 'mongoose'

const socialSchema = new mongoose.Schema({
  platform: String,
  url: String
}, { _id: false })

const personSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, sparse: true },
  role: { type: String, enum: ['founder', 'management'] },
  name: String,
  title: String,
  designation: String,
  photo: String,
  bannerUrl: String,
  place: String,
  publicNote: String,
  bioEn: String,
  bioHi: String,
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  socials: [socialSchema]
}, { timestamps: true })

personSchema.index({ userId: 1 }, { unique: true, sparse: true })

export const Person = mongoose.model('Person', personSchema)
