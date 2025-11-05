// backend/src/scripts/seed_people.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { User } from '../models/User.js'
import { Person } from '../models/Person.js'
import { Plan } from '../models/Plan.js'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI
if (!uri) {
  console.error('❌ MONGO_URI / MONGODB_URI not found in backend/.env')
  process.exit(1)
}

async function ensureFounderPlan() {
  try {
    let plan = await Plan.findOne({ code: 'founder' })
    if (!plan) {
      plan = await Plan.create({
        code: 'founder',
        titleEn: 'Founder',
        titleHi: 'संस्थापक',
        price: 0,
        order: 1,
        active: true,
      })
    }
    return plan
  } catch {
    return null
  }
}

const avatar = (n) => `https://i.pravatar.cc/150?img=${n}`

const FOUNDERS = [
  { name: 'Chaudhary Nathu Singh', title: 'Chairperson', place: 'Jaipur, Rajasthan', img: 12 },
  { name: 'Dr. Meera Jakhar', title: 'Co-Founder', place: 'Bikaner, Rajasthan', img: 47 },
  { name: 'Sandeep Poonia', title: 'Trustee', place: 'Jhunjhunu, Rajasthan', img: 31 },
  { name: 'Rajesh Dhaka', title: 'Patron', place: 'Sikar, Rajasthan', img: 22 },
  { name: 'Anita Sheoran', title: 'Co-Founder', place: 'Rohtak, Haryana', img: 65 },
  { name: 'Capt. Virendra', title: 'Advisor', place: 'Hisar, Haryana', img: 9 },
  { name: 'Sunita Malik', title: 'Founder Member', place: 'Sonipat, Haryana', img: 48 },
  { name: 'Prakash Dudi', title: 'Trustee', place: 'Nagaur, Rajasthan', img: 67 },
  { name: 'Vikas Sangwan', title: 'Founder Member', place: 'Churu, Rajasthan', img: 22 },
  { name: 'Kiran Hooda', title: 'Patron', place: 'Gurugram, Haryana', img: 65 },
]

const MANAGEMENT = [
  { name: 'Ritu Kadian', title: 'Operations Lead', place: 'Delhi', img: 14 },
  { name: 'Saurabh Rathee', title: 'Program Director', place: 'Noida, UP', img: 28 },
  { name: 'Neha Sehrawat', title: 'Product Manager', place: 'New Delhi', img: 48 },
  { name: 'Amit Nain', title: 'Tech Lead', place: 'Jaipur, Rajasthan', img: 35 },
  { name: 'Pooja Deswal', title: 'Community Manager', place: 'New Delhi', img: 67 },
  { name: 'Rohit Kadian', title: 'Youth Affairs', place: 'Jhajjar, Haryana', img: 9 },
  { name: 'Komal Dahiya', title: 'Partnerships', place: 'Panipat, Haryana', img: 19 },
  { name: 'Gaurav Lamba', title: 'Finance & Audit', place: 'Rewari, Haryana', img: 7 },
  { name: 'Deepika Sihag', title: 'HR & Training', place: 'Bhiwani, Haryana', img: 61 },
  { name: 'Arun Jakhar', title: 'Field Ops', place: 'Hanumangarh, Rajasthan', img: 40 },
]

async function main() {
  console.log('Connecting to', uri)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  console.log('✅ Connected')

  const founderPlan = await ensureFounderPlan()
  const passwordHash = await bcrypt.hash('pass1234', 10)

  // Remove ONLY previous seed users/persons
  const seedEmailRegex = /seed-(founder|mgmt)-\d+@example\.com/
  const oldSeedUsers = await User.find({ email: seedEmailRegex }, { _id: 1 })
  if (oldSeedUsers.length) {
    await Person.deleteMany({ userId: { $in: oldSeedUsers.map(u => u._id) } })
    await User.deleteMany({ _id: { $in: oldSeedUsers.map(u => u._id) } })
    console.log(`🧹 Removed previous seed users/persons: ${oldSeedUsers.length}`)
  }

  let phoneBase = 9100000000

  const createUserAndPerson = async ({ idx, bucket, role, data }) => {
    const num = (idx + 1).toString().padStart(2, '0')
    const email = `seed-${bucket}-${num}@example.com`
    const phone = String(phoneBase + idx)

    // ✅ give each user a unique referralCode to satisfy unique index
    const referralCode = `SEED-${bucket.toUpperCase()}-${num}`

    const city = data.place.split(', ')[0] || ''
    const state = data.place.split(', ').slice(-1)[0] || ''

    const user = await User.create({
      name: data.name,
      displayName: data.name,
      email,
      phone,
      passwordHash,
      referralCode,             // <-- important change
      role: 'founder',          // account tier; public listing uses Person.role below
      avatarUrl: avatar(data.img),
      publicNote: role === 'founder' ? 'Serving as Founder' : 'Management team',
      occupation: data.title,
      company: 'Jat Parivar',
      gender: 'other',
      maritalStatus: 'married',
      address: { state, district: '', city, pin: '' },
      gotra: { self: 'Jat', mother: 'Jat', dadi: 'Jat', nani: 'Jat' },
      ...(founderPlan && {
        planId: founderPlan._id,
        planTitle: founderPlan.titleEn,
        planAmount: founderPlan.price,
      }),
      status: 'active',
    })

    await Person.create({
      userId: user._id,
      role, // 'founder' | 'management' — used by /public/people
      name: data.name,
      designation: role === 'founder' ? 'Founder' : 'Management',
      title: data.title,
      photo: user.avatarUrl,
      place: data.place,
      visible: true,
      order: idx + 1,
      publicNote: user.publicNote,
      bioEn: role === 'founder' ? 'Entrepreneur & community patron.' : 'Core operations team.',
      socials: [],
    })
  }

  // founders
  await Promise.all(
    FOUNDERS.map((f, i) =>
      createUserAndPerson({ idx: i, bucket: 'founder', role: 'founder', data: f })
    )
  )
  console.log(`👑 Seeded founders: ${FOUNDERS.length}`)

  // management
  phoneBase = 9200000000
  await Promise.all(
    MANAGEMENT.map((m, i) =>
      createUserAndPerson({ idx: i, bucket: 'mgmt', role: 'management', data: m })
    )
  )
  console.log(`🛠️  Seeded management: ${MANAGEMENT.length}`)

  console.log('✅ People seeding complete.')
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
