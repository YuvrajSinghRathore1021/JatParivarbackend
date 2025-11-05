// backend/src/models/Admin.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const adminSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  email: { type: String },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  roles: {
    type: [String],
    enum: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'],
    default: ['SUPER_ADMIN']
  },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  mustChangePassword: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  lastLoginAt: { type: Date },
  sessionVersion: { type: Number, default: 1 },
  deletedAt: { type: Date }
}, { timestamps: true })

adminSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash)
}

adminSchema.methods.hasRole = function (role) {
  return this.roles.includes('SUPER_ADMIN') || this.roles.includes(role)
}

export const Admin = mongoose.model('Admin', adminSchema)
