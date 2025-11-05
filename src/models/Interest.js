// backend/src/models/Interest.js
import mongoose from 'mongoose'
export const Interest = mongoose.model('Interest', new mongoose.Schema({
  fromUserId: { type: mongoose.Types.ObjectId, ref:'User' },
  toUserId: { type: mongoose.Types.ObjectId, ref:'User' },
  status: { type:String, enum:['sent','accepted','rejected'], default:'sent' }
}, { timestamps:true }))
