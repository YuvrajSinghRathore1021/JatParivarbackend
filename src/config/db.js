// backend/src/config/db.js
import mongoose from 'mongoose'
import { CONFIG } from './env.js'
export const connectDB = async () => {
  await mongoose.connect(CONFIG.MONGO_URI)
  console.log('MongoDB connected')
}
