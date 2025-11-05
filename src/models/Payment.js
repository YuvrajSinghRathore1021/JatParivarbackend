// backend/src/models/Payment.js
import mongoose from 'mongoose'

export const Payment = mongoose.model('Payment', new mongoose.Schema({
  preSignupId: { type: mongoose.Types.ObjectId, ref: 'PreSignup' },
  userId: { type: mongoose.Types.ObjectId, ref: 'User' },
  planId: { type: mongoose.Types.ObjectId, ref: 'Plan' },
  planTitle: String,
  orderId: { type: String, unique: true },
  merchantTransactionId: { type: String, unique: true },
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'pending', 'success', 'failed', 'refunded'], default: 'created' },
  provider: { type: String, enum: ['phonepe', 'manual'], default: 'phonepe' },
  raw: Object,
  notes: String,
  leaderboardVisible: { type: Boolean, default: true },
  reconciledAt: Date,
  reconciledBy: { type: mongoose.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }))
