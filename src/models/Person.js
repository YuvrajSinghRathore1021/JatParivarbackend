// backend/src/models/Person.js
import mongoose from 'mongoose'

const socialSchema = new mongoose.Schema({
  platform: String,
  url: String
}, { _id: false })

export const Person = mongoose.model('Person', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['founder', 'management'] },
  name: String,
  title: String,
  designation: String,
  photo: String,
  place: String,
  publicNote: String,
  bioEn: String,
  bioHi: String,
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  socials: [socialSchema]
}, { timestamps: true }))
