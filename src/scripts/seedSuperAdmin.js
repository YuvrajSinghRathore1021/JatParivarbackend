// backend/src/scripts/seedSuperAdmin.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env from backend/.env (two levels up from this file)
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { Admin } from '../models/Admin.js'

// Accept either env var name
const uri = process.env.MONGO_URI || process.env.MONGODB_URI
if (!uri) {
  console.error('❌ MONGO_URI / MONGODB_URI not found in backend/.env')
  process.exit(1)
}

const phone = process.env.SEED_SUPER_ADMIN_PHONE || '9999999999'
const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'ChangeMe123'
const name = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin'
const email = process.env.SEED_SUPER_ADMIN_EMAIL || ''

async function main () {
  console.log('Connecting to', uri)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  console.log('✅ Connected')

  let admin = await Admin.findOne({ phone })

  if (!admin) {
    admin = await Admin.create({
      phone,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      roles: ['SUPER_ADMIN'],
      mustChangePassword: true,
      status: 'active',
    })
    console.log('Created super admin', phone)
  } else {
    admin.passwordHash = await bcrypt.hash(password, 10)
    admin.roles = Array.from(new Set([...(admin.roles || []), 'SUPER_ADMIN']))
    admin.mustChangePassword = false
    await admin.save()
    console.log('Updated super admin password', phone)
  }

  await mongoose.disconnect()
  console.log('✅ Done')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
