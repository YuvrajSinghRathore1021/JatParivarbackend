// backend/src/models/User.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { ensurePersonForUser, mapUserRoleToPersonRole, removePersonForUser } from '../utils/personSync.js'
import { generateUniqueReferralCode, normalizeReferralCode } from '../utils/referral.js'

const PERSON_SYNC_ENABLED = process.env.DISABLE_PERSON_SYNC !== '1'

const occupationAddressSchema = new mongoose.Schema({
  occupationaddress: String,
  state: String,
  stateCode: String,
  district: String,
  districtCode: String,
  city: String,
  cityCode: String,
  village: String
}, { _id: false })

const currentAddressSchema = new mongoose.Schema({
  currentaddress: String,
  state: String,
  stateCode: String,
  district: String,
  districtCode: String,
  city: String,
  cityCode: String,
  village: String
}, { _id: false })

const parentalAddressSchema = new mongoose.Schema({
  currentaddress: String,
  state: String,
  stateCode: String,
  district: String,
  districtCode: String,
  city: String,
  cityCode: String,
  village: String
}, { _id: false })


const gotraSchema = new mongoose.Schema({
  self: String,
  mother: String,
  dadi: String,
  nani: String
}, { _id: false })



const userSchema = new mongoose.Schema({
  name: String,
  displayName: String,
  email: { type: String, index: true },
  phone: { type: String, unique: true },
  passwordHash: String,
  // User role is for membership/public listing only. Admin access is controlled via the separate Admin model.
  role: { type: String, enum: ['founder', 'management', 'sadharan'], default: 'sadharan' },
  roles: { type: [String], default: [] },
  sessionVersion: { type: Number, default: 1 },
  referralCode: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
  avatarUrl: String,
  publicNote: String,
  occupation: String,
  designation: String,
  department: String,
 
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
  dateOfBirth: Date,
  // occupationAddress,currentAddress,parentalAddress
  occupationAddress: occupationAddressSchema,
  currentAddress: currentAddressSchema,
  parentalAddress: parentalAddressSchema,
  gotra: gotraSchema,
  contactEmail: String,
  alternatePhone: String,
  showPhoneOnPublic: { type: Boolean, default: false },
  education: String,
    department: String,
    designation: String,
  profession: String,
  maritalStatus: String,
  planId: { type: mongoose.Types.ObjectId, ref: 'Plan' },
  planTitle: String,
  planAmount: Number,
  status: { type: String, enum: ['active', 'disabled', 'pending'], default: 'active' },
  janAadhaarUrl: String,
  bussinessurl: String,
  adimage: String,
  message: String,
  documents: [{ name: String, url: String }],
  customFields: { type: Map, of: String }
}, { timestamps: true })

userSchema.methods.compare = function (pw) {
  return bcrypt.compare(pw, this.passwordHash)
}

userSchema.pre('validate', async function () {
  if (this.role === 'member') this.role = 'management'
  // Back-compat cleanup: user.role must never be "admin" (admins are in Admin collection).
  if (this.role === 'admin') this.role = 'sadharan'
  if (this.referralCode) {
    this.referralCode = normalizeReferralCode(this.referralCode)
  }
  if (this.isNew && !this.referralCode) {
    this.referralCode = await generateUniqueReferralCode(this.constructor)
  }
})

const syncPersonFromUser = async (doc) => {
  if (!doc) return
  const personRole = mapUserRoleToPersonRole(doc.role)
  if (personRole) {
    await ensurePersonForUser(doc, {
      name: doc.displayName || doc.name,
      photo: doc.avatarUrl,
      place: doc.address?.city,
      publicNote: doc.publicNote
    })
  } else {
    await removePersonForUser(doc._id)
  }
}

const logSyncError = (err) => {
  if (err) {
    console.error('[personSync] Failed to sync person profile', err)
  }
}

userSchema.post('save', function (doc) {
  if (!PERSON_SYNC_ENABLED) return
  syncPersonFromUser(doc).catch(logSyncError)
})

userSchema.post('findOneAndUpdate', function (doc) {
  if (!PERSON_SYNC_ENABLED) return
  const targetId = doc?._id || this.getQuery()?._id
  if (!targetId) return
  this.model.findById(targetId).then((updated) => {
    if (updated) {
      return syncPersonFromUser(updated)
    }
    return null
  }).catch(logSyncError)
})

userSchema.post('deleteOne', { document: true, query: false }, function () {
  if (!PERSON_SYNC_ENABLED) return
  removePersonForUser(this._id).catch(logSyncError)
})

userSchema.post('findOneAndDelete', function (doc) {
  if (!PERSON_SYNC_ENABLED) return
  if (!doc) return
  removePersonForUser(doc._id).catch(logSyncError)
})

export const User = mongoose.model('User', userSchema)
