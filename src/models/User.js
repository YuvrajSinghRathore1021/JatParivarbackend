// backend/src/models/User.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  state: String,
  district: String,
  city: String,
  pin: String
}, { _id: false })

const gotraSchema = new mongoose.Schema({
  self: String,
  mother: String,
  dadi: String,
  nani: String
}, { _id: false })

const educationSchema = new mongoose.Schema({
  highestQualification: String,
  institution: String,
  year: String
}, { _id: false })

const userSchema = new mongoose.Schema({
  name: String,
  displayName: String,
  email: { type: String, index: true },
  phone: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'founder', 'member', 'sadharan'], default: 'sadharan' },
  roles: { type: [String], default: [] },
  sessionVersion: { type: Number, default: 1 },
  referralCode: { type: String, unique: true },
  avatarUrl: String,
  publicNote: String,
  occupation: String,
  company: String,
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
  dateOfBirth: Date,
  address: addressSchema,
  gotra: gotraSchema,
  contactEmail: String,
  alternatePhone: String,
  education: educationSchema,
  profession: String,
  maritalStatus: String,
  planId: { type: mongoose.Types.ObjectId, ref: 'Plan' },
  planTitle: String,
  planAmount: Number,
  status: { type: String, enum: ['active', 'disabled', 'pending'], default: 'active' },
  janAadhaarUrl: String,
  documents: [{ name: String, url: String }],
  customFields: { type: Map, of: String }
}, { timestamps: true })

userSchema.methods.compare = function (pw) {
  return bcrypt.compare(pw, this.passwordHash)
}

export const User = mongoose.model('User', userSchema)
