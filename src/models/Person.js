// backend/src/models/Person.js
import mongoose from 'mongoose'
/* ------------------ Address Schema ------------------ */
const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  district: String,
  state: String,
  country: String,
  pincode: String
}, { _id: false })
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
    department: String,
  education: String,
  photo: String,
  bannerUrl: String,
  bussinessurl: String,
  adimage: String,
  message: String,
  place: String,
  publicNote: String,
  bioEn: String,
  bioHi: String,
  // 🔹 NEW: 3 Addresses
  currentAddress: addressSchema,
  parentalAddress: addressSchema,
  occupationAddress: addressSchema,

  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  socials: [socialSchema],

}, { timestamps: true })

personSchema.index({ userId: 1 }, { unique: true, sparse: true })

export const Person = mongoose.model('Person', personSchema)
