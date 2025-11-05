// backend/src/models/Membership.js
import mongoose from 'mongoose'
export const Membership = mongoose.model('Membership', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref:'User' },
  plan: { type:String, enum:['founder','member','sadharan'] },
  status: { type:String, enum:['active','expired'], default:'active' },
  startedAt: Date
}, { timestamps:true }))
