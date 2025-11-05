// backend/src/models/Institution.js
import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  bookingUrl: String
}, { _id: false })

const amenitySchema = new mongoose.Schema({
  key: String,
  label: String
}, { _id: false })

const imageSchema = new mongoose.Schema({
  url: String,
  altEn: String,
  altHi: String,
  order: { type: Number, default: 0 }
}, { _id: false })

export const Institution = mongoose.model('Institution', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  kind: { type: String, enum: ['dharamshala', 'sanstha'] },
  titleEn: { type: String, required: true },
  titleHi: { type: String },
  descriptionEn: String,
  descriptionHi: String,
  addressEn: String,
  addressHi: String,
  state: String,
  district: String,
  city: String,
  pin: String,
  amenities: [amenitySchema],
  contact: contactSchema,
  images: [imageSchema],
  published: { type: Boolean, default: false },
  approved: { type: Boolean, default: false }
}, { timestamps: true }))
