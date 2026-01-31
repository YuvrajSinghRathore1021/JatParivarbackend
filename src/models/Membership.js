// backend/src/models/Membership.js
import mongoose from 'mongoose'
const membershipSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref:'User' },
  plan: { type:String, enum:['founder','management','sadharan'] },
  status: { type:String, enum:['active','expired'], default:'active' },
  startedAt: Date
}, { timestamps:true })

membershipSchema.pre('validate', function () {
  if (this.plan === 'member') this.plan = 'management'
})

export const Membership = mongoose.model('Membership', membershipSchema)
