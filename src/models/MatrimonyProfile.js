// // backend/src/models/MatrimonyProfile.js
// import mongoose from 'mongoose'
// export const MatrimonyProfile = mongoose.model('MatrimonyProfile', new mongoose.Schema({
//   userId: { type: mongoose.Types.ObjectId, ref: 'User', unique: true,sparse: true  },
//   visible: { type: Boolean, default: true },
//   age: Number,
//   gender: String,
//   name: String,
//   height: String,
//   maritalStatus: String,
//   education: String,
//   address: String,
//   parentaladdress: String,
//   occupation: String,
//   state: String, district: String, city: String, village: String,
//   gotra: { self: String, mother: String, nani: String, dadi: String },
//   photos: [String],
// }, { timestamps: true }))















import mongoose from 'mongoose'
export const MatrimonyProfile = mongoose.model('MatrimonyProfile', new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  visible: { type: Boolean, default: true },
  age: Number,
  gender: String,
  name: String,
  height: String,
  maritalStatus: String,
  education: String,
    department: String,
    designation: String,
  occupation: String,
  gotra: { self: String, mother: String, nani: String, dadi: String },
  photos: [String],
  currentAddress: {
    state: String,
    stateCode: String,
    district: String,
    districtCode: String,
    city: String,
    cityCode: String,
    village: String
  },
  occupationAddress: {
    state: String,
    stateCode: String,
    district: String,
    districtCode: String,
    city: String,
    cityCode: String,
    village: String
  },
  parentalAddress: {
    state: String,
    stateCode: String,
    district: String,
    districtCode: String,
    city: String,
    cityCode: String,
    village: String
  }
  
}, { timestamps: true }))
