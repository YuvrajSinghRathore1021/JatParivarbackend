// backend/src/models/PreSignup.js
import mongoose from 'mongoose'
const preSchema = new mongoose.Schema({
  phone: String,
  refCode: String,
  form: Object,
  addr: Object,
  gotra: Object,
  janAadharUrl: String,
  profilePhotoUrl: String,
  plan: { type:String, enum:['founder','management','sadharan'] },
  status: { type:String, enum:['pending','paid','failed'], default:'pending' }
},{ timestamps:true })

preSchema.pre('validate', function () {
  if (this.plan === 'member') this.plan = 'management'
})
export const PreSignup = mongoose.model('PreSignup', preSchema)
