// backend/src/scripts/seed.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Load .env from the repo root: backend/.env (two levels up from this file)
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../../.env') })

// models…
import { Admin } from '../models/Admin.js'
import { Plan } from '../models/Plan.js'
import { User } from '../models/User.js'
import { Person } from '../models/Person.js'
import { Membership } from '../models/Membership.js'
import { Achievement } from '../models/Achievement.js'
import { Page } from '../models/Page.js'
import { PageVersion } from '../models/PageVersion.js'
import { HistoryItem } from '../models/HistoryItem.js'
import { NewsItem } from '../models/NewsItem.js'
import { Institution } from '../models/Institution.js'
import { MatrimonyProfile } from '../models/MatrimonyProfile.js'
import { Interest } from '../models/Interest.js'
import { JobPost } from '../models/JobPost.js'
import { JobApplication } from '../models/JobApplication.js'
import { Payment } from '../models/Payment.js'
import { PreSignup } from '../models/PreSignup.js'

// Accept either env var name
const uri = process.env.MONGO_URI || process.env.MONGODB_URI
if (!uri) {
  console.error('❌ MONGO_URI / MONGODB_URI not found in .env (backend/.env)')
  process.exit(1)
}

function oid(hex) { return new mongoose.Types.ObjectId(hex) }

// -------- main ----------
async function main() {
  console.log('Connecting to', uri)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  console.log('✅ Connected')

  // ---- Admin ---------------------------------------------------------------
  await Admin.deleteMany({})
  const adminPw = await bcrypt.hash('admin@123', 10)
  const admin = await Admin.create({
    phone: '9800000000',
    email: 'admin@example.com',
    name: 'Super Admin',
    passwordHash: adminPw,
    roles: ['SUPER_ADMIN'],
    status: 'active',
  })
  console.log('👤 Admin:', admin.phone)

  // ---- Plans ---------------------------------------------------------------
  await Plan.deleteMany({})
  const [pFounder, pMember, pSadharan] = await Plan.insertMany([
    { code: 'founder',  titleEn: 'Founder',  titleHi: 'संस्थापक', price: 250000, order: 1, active: true },
    { code: 'member',   titleEn: 'Member',   titleHi: 'सदस्य',     price: 1000,   order: 2, active: true },
    { code: 'sadharan', titleEn: 'General',  titleHi: 'साधारण',    price: 0,      order: 3, active: true },
  ])
  console.log('📦 Plans:', [pFounder.code, pMember.code, pSadharan.code].join(', '))

  // ---- Users ---------------------------------------------------------------
  await User.deleteMany({})
  const userPw = await bcrypt.hash('pass1234', 10)

  const users = await User.insertMany([
    {
      // Founder + person card
      name: 'Rajesh Kumar', displayName: 'Rajesh Kumar',
      email: 'rajesh@example.com', phone: '9000000001',
      passwordHash: userPw, role: 'founder',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
      publicNote: 'Serving the community.',
      occupation: 'Business Owner', company: 'Kumar Agro',
      gender: 'male', maritalStatus: 'married',
      address: { state: 'Rajasthan', district: 'Jaipur', city: 'Jaipur', pin: '302001' },
      gotra: { self: 'Sheoran', mother: 'Dahiya', dadi: 'Sangwan', nani: 'Puniah' },
      planId: pFounder._id, planTitle: pFounder.titleEn, planAmount: pFounder.price,
      status: 'active',
    },
    {
      // Management + person card
      name: 'Sunita Malik', displayName: 'Dr. Sunita Malik',
      email: 'sunita@example.com', phone: '9000000002',
      passwordHash: userPw, role: 'founder',
      avatarUrl: 'https://i.pravatar.cc/150?img=47',
      publicNote: 'Education & empowerment.',
      occupation: 'Principal', company: 'Jat High School',
      gender: 'female', maritalStatus: 'married',
      address: { state: 'Haryana', district: 'Rohtak', city: 'Rohtak', pin: '124001' },
      gotra: { self: 'Malik', mother: 'Sihag', dadi: 'Nain', nani: 'Kharb' },
      planId: pFounder._id, planTitle: pFounder.titleEn, planAmount: pFounder.price,
      status: 'active',
    },
    {
      // Member (for home strip)
      name: 'Ankit Dahiya', displayName: 'Ankit Dahiya',
      email: 'ankit@example.com', phone: '9000000003',
      passwordHash: userPw, role: 'member',
      avatarUrl: 'https://i.pravatar.cc/150?img=31',
      occupation: 'Software Engineer', company: 'TCS',
      gender: 'male', maritalStatus: 'never_married',
      address: { state: 'Delhi', district: 'New Delhi', city: 'Dwarka', pin: '110077' },
      gotra: { self: 'Dahiya', mother: 'Rathee', dadi: 'Kadian', nani: 'Deswal' },
      planId: pMember._id, planTitle: pMember.titleEn, planAmount: pMember.price,
      status: 'active',
    },
    {
      // Member
      name: 'Kiran Hooda', displayName: 'Kiran Hooda',
      email: 'kiran@example.com', phone: '9000000004',
      passwordHash: userPw, role: 'member',
      avatarUrl: 'https://i.pravatar.cc/150?img=65',
      occupation: 'Chartered Accountant', company: 'EY',
      gender: 'female', maritalStatus: 'never_married',
      address: { state: 'Haryana', district: 'Sonipat', city: 'Gohana', pin: '131301' },
      gotra: { self: 'Hooda', mother: 'Maan', dadi: 'Jakhar', nani: 'Sangwan' },
      planId: pMember._id, planTitle: pMember.titleEn, planAmount: pMember.price,
      status: 'active',
    },
    {
      // Member
      name: 'Vikas Sangwan', displayName: 'Vikas Sangwan',
      email: 'vikas@example.com', phone: '9000000005',
      passwordHash: userPw, role: 'member',
      avatarUrl: 'https://i.pravatar.cc/150?img=22',
      occupation: 'Civil Engineer', company: 'L&T',
      gender: 'male', maritalStatus: 'never_married',
      address: { state: 'Rajasthan', district: 'Sikar', city: 'Sikar', pin: '332001' },
      gotra: { self: 'Sangwan', mother: 'Joon', dadi: 'Duhan', nani: 'Lamba' },
      planId: pMember._id, planTitle: pMember.titleEn, planAmount: pMember.price,
      status: 'active',
    },
    {
      // Member
      name: 'Neha Sehrawat', displayName: 'Neha Sehrawat',
      email: 'neha@example.com', phone: '9000000006',
      passwordHash: userPw, role: 'member',
      avatarUrl: 'https://i.pravatar.cc/150?img=48',
      occupation: 'Product Manager', company: 'Flipkart',
      gender: 'female', maritalStatus: 'never_married',
      address: { state: 'Delhi', district: 'South West', city: 'Dwarka', pin: '110078' },
      gotra: { self: 'Sehrawat', mother: 'Khatri', dadi: 'Dabas', nani: 'Sangwan' },
      planId: pMember._id, planTitle: pMember.titleEn, planAmount: pMember.price,
      status: 'active',
    },
    {
      // Member
      name: 'Pooja Deswal', displayName: 'Pooja Deswal',
      email: 'pooja@example.com', phone: '9000000007',
      passwordHash: userPw, role: 'member',
      avatarUrl: 'https://i.pravatar.cc/150?img=67',
      occupation: 'Doctor', company: 'AIIMS',
      gender: 'female', maritalStatus: 'never_married',
      address: { state: 'Delhi', district: 'New Delhi', city: 'Saket', pin: '110017' },
      gotra: { self: 'Deswal', mother: 'Sihag', dadi: 'Nain', nani: 'Punia' },
      planId: pMember._id, planTitle: pMember.titleEn, planAmount: pMember.price,
      status: 'active',
    },
    {
      // Sadharan
      name: 'Rohit Kadian', displayName: 'Rohit Kadian',
      email: 'rohit@example.com', phone: '9000000008',
      passwordHash: userPw, role: 'sadharan',
      avatarUrl: 'https://i.pravatar.cc/150?img=9',
      occupation: 'Student', company: '',
      gender: 'male', maritalStatus: 'never_married',
      address: { state: 'Haryana', district: 'Jhajjar', city: 'Bahadurgarh', pin: '124507' },
      gotra: { self: 'Kadian', mother: 'Dahiya', dadi: 'Sangwan', nani: 'Sheoran' },
      planId: pSadharan._id, planTitle: pSadharan.titleEn, planAmount: pSadharan.price,
      status: 'active',
    },
  ])
  console.log('👥 Users:', users.length)

  // ---- Memberships (optional/demo) ----------------------------------------
  await Membership.deleteMany({})
  await Membership.insertMany(users.map(u => ({
    userId: u._id,
    plan: u.role === 'founder' ? 'founder' : (u.role === 'member' ? 'member' : 'sadharan'),
    status: 'active',
    startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
  })))

  // ---- Persons (Founders/Management) for home strips ----------------------
  await Person.deleteMany({})
  const persons = await Person.insertMany([
    {
      userId: users[0]._id, role: 'founder', name: users[0].displayName,
      designation: 'Founder', title: 'Chairperson', photo: users[0].avatarUrl,
      place: 'Jaipur, Rajasthan', visible: true, order: 1,
      publicNote: users[0].publicNote, bioEn: 'Entrepreneur & community builder.',
      socials: [{ platform: 'linkedin', url: 'https://linkedin.com' }],
    },
    {
      userId: users[1]._id, role: 'management', name: users[1].displayName,
      designation: 'Management', title: 'Director', photo: users[1].avatarUrl,
      place: 'Rohtak, Haryana', visible: true, order: 2,
      publicNote: users[1].publicNote, bioEn: 'Educationist and mentor.',
    },
  ])
  console.log('🧑‍🤝‍🧑 Persons:', persons.length)

  // ---- Achievements (home strip) ------------------------------------------
  await Achievement.deleteMany({})
  await Achievement.insertMany([
    { textEn: '5000+ members joined', textHi: '5000+ सदस्य जुड़े', order: 1, active: true },
    { textEn: '200+ jobs posted', textHi: '200+ नौकरियाँ पोस्ट', order: 2, active: true },
    { textEn: '100+ marriages supported', textHi: '100+ विवाह सहयोग', order: 3, active: true },
  ])

  // ---- Pages (+versions) ---------------------------------------------------
  await Page.deleteMany({})
  await PageVersion.deleteMany({})
  const about = await Page.create({
    slug: 'about', titleEn: 'About Jat Parivar', titleHi: 'जाट परिवार के बारे में',
    status: 'published', publishedAt: new Date(), updatedBy: admin._id,
    contentEn: { blocks: [{ type: 'p', text: 'We are a community-driven platform.' }] },
    contentHi: { blocks: [{ type: 'p', text: 'हम एक समुदाय-आधारित मंच हैं।' }] },
  })
  await PageVersion.create({
    pageId: about._id, version: 1, titleEn: about.titleEn, titleHi: about.titleHi,
    contentEn: about.contentEn, contentHi: about.contentHi, published: true, publishedAt: new Date(),
    createdBy: admin._id, summary: 'Initial publish',
  })

  // ---- History / News ------------------------------------------------------
  await HistoryItem.deleteMany({})
  await HistoryItem.insertMany([
    {
      category: 'history',
      titleEn: 'Battle of 1739', titleHi: '1739 की ऐतिहासिक लड़ाई',
      bodyEn: 'A landmark in our history.', imageUrl: 'https://picsum.photos/seed/hist1/600/300',
      published: true, publishedAt: new Date(), createdBy: admin._id
    },
    {
      category: 'bhamashah',
      titleEn: 'Bhamashah of the Year', titleHi: 'वर्ष का भामाशाह',
      bodyEn: 'Recognizing philanthropy.',
      published: true, publishedAt: new Date(), createdBy: admin._id
    },
  ])

  await NewsItem.deleteMany({})
  await NewsItem.insertMany([
    {
      slug: 'community-meet-1',
      titleEn: 'Community Meet in Jaipur', titleHi: 'जयपुर में समुदाय बैठक',
      excerptEn: 'Highlights from the event.',
      bodyEn: 'Full body of the news.',
      heroImageUrl: 'https://picsum.photos/seed/news1/800/400',
      published: true, publishedAt: new Date(), createdBy: admin._id
    },
  ])

  // ---- Institutions (approved) --------------------------------------------
  await Institution.deleteMany({})
  const inst = await Institution.insertMany([
    {
      userId: users[2]._id,
      kind: 'dharamshala',
      titleEn: 'Shree Jat Dharamshala', titleHi: 'श्री जाट धर्मशाला',
      descriptionEn: 'Clean rooms, family-friendly.', descriptionHi: 'स्वच्छ कमरे, परिवार अनुकूल।',
      addressEn: 'Near Bus Stand', state: 'Rajasthan', district: 'Sikar', city: 'Sikar', pin: '332001',
      amenities: [{ key: 'parking', label: 'Parking' }, { key: 'wifi', label: 'WiFi' }],
      contact: { name: 'Manager', phone: '9111111111', email: 'dh@jat.org' },
      images: [{ url: 'https://picsum.photos/seed/dh1/640/360', altEn: 'Front view', order: 1 }],
      approved: true, published: true
    },
    {
      userId: users[3]._id,
      kind: 'sanstha',
      titleEn: 'Jat Education Trust', titleHi: 'जाट शिक्षा ट्रस्ट',
      descriptionEn: 'Scholarships and coaching.', descriptionHi: 'छात्रवृत्ति और कोचिंग।',
      state: 'Haryana', district: 'Rohtak', city: 'Rohtak', pin: '124001',
      contact: { name: 'Office', phone: '9222222222', email: 'trust@jat.org' },
      images: [{ url: 'https://picsum.photos/seed/s1/640/360', altEn: 'Office', order: 1 }],
      approved: true, published: true
    },
  ])
  console.log('🏨 Institutions:', inst.length)

  // ---- Matrimony Profiles --------------------------------------------------
  await MatrimonyProfile.deleteMany({})
  const profiles = await MatrimonyProfile.insertMany([
    {
      userId: users[2]._id, visible: true, age: 28, gender: 'male',
      maritalStatus: 'never_married', education: 'B.Tech (CSE)',
      occupation: users[2].occupation, state: 'Delhi', district: 'New Delhi', city: 'Dwarka', village: '',
      gotra: users[2].gotra, photos: []
    },
    {
      userId: users[3]._id, visible: true, age: 26, gender: 'female',
      maritalStatus: 'never_married', education: 'CA',
      occupation: users[3].occupation, state: 'Haryana', district: 'Sonipat', city: 'Gohana', village: '',
      gotra: users[3].gotra, photos: []
    },
    {
      userId: users[4]._id, visible: true, age: 29, gender: 'male',
      maritalStatus: 'never_married', education: 'B.E. Civil',
      occupation: users[4].occupation, state: 'Rajasthan', district: 'Sikar', city: 'Sikar', village: 'Village A',
      gotra: users[4].gotra, photos: []
    },
    {
      userId: users[5]._id, visible: true, age: 25, gender: 'female',
      maritalStatus: 'never_married', education: 'MBA',
      occupation: users[5].occupation, state: 'Delhi', district: 'South West', city: 'Dwarka', village: '',
      gotra: users[5].gotra, photos: []
    },
    {
      userId: users[6]._id, visible: false, age: 27, gender: 'female',
      maritalStatus: 'never_married', education: 'MBBS',
      occupation: users[6].occupation, state: 'Delhi', district: 'New Delhi', city: 'Saket', village: '',
      gotra: users[6].gotra, photos: []
    },
  ])
  console.log('💍 Matrimony profiles:', profiles.length)

  // Interests (some accepted)
  await Interest.deleteMany({})
  await Interest.insertMany([
    // Ankit -> Kiran (sent)
    { fromUserId: users[2]._id, toUserId: users[3]._id, status: 'sent' },
    // Kiran -> Ankit (accepted) (both sides)
    { fromUserId: users[3]._id, toUserId: users[2]._id, status: 'accepted' },
    // Vikas -> Neha (sent)
    { fromUserId: users[4]._id, toUserId: users[5]._id, status: 'sent' },
    // Neha -> Vikas (accepted)
    { fromUserId: users[5]._id, toUserId: users[4]._id, status: 'accepted' },
  ])

  // ---- Jobs + Applications -------------------------------------------------
  await JobPost.deleteMany({})
  const jobs = await JobPost.insertMany([
    {
      userId: users[2]._id, title: 'Frontend Developer (React)',
      description: 'Work on community platform UI.',
      locationState: 'Delhi', locationCity: 'New Delhi',
      type: 'full_time', salaryRange: '6–10 LPA',
      contactPhone: '9333333333', approved: true
    },
    {
      userId: users[3]._id, title: 'Accountant',
      description: 'Manage trust accounts and audits.',
      locationState: 'Haryana', locationCity: 'Rohtak',
      type: 'full_time', salaryRange: '3–5 LPA',
      contactPhone: '9444444444', approved: true
    },
    {
      userId: users[4]._id, title: 'Site Engineer (Contract)',
      description: '2-month contract at Sikar site.',
      locationState: 'Rajasthan', locationCity: 'Sikar',
      type: 'contract', salaryRange: '₹35k/month',
      contactPhone: '9555555555', approved: false // to test "hidden until approved"
    },
  ])
  console.log('🧾 Jobs:', jobs.length)

  await JobApplication.deleteMany({})
  await JobApplication.insertMany([
    { jobId: jobs[0]._id, applicantId: users[5]._id, coverLetter: 'I love building UIs.', expectedSalary: '8 LPA', status: 'submitted' },
    { jobId: jobs[1]._id, applicantId: users[4]._id, coverLetter: 'Experienced with Tally & GST.', expectedSalary: '4.2 LPA', status: 'shortlisted' },
  ])

  // ---- Payments / PreSignup (just a couple for admin screens) -------------
  await PreSignup.deleteMany({})
  const pre = await PreSignup.create({
    phone: '9666666666',
    refCode: 'REF123',
    form: { name: 'Demo Lead' },
    plan: 'member',
    status: 'paid',
  })

  await Payment.deleteMany({})
  await Payment.insertMany([
    {
      preSignupId: pre._id,
      userId: users[2]._id,
      planId: pMember._id, planTitle: pMember.titleEn,
      orderId: 'ORD-10001', merchantTransactionId: 'MTX-10001',
      amount: pMember.price, status: 'success', provider: 'manual',
      notes: 'Seed payment'
    },
    {
      userId: users[0]._id,
      planId: pFounder._id, planTitle: pFounder.titleEn,
      orderId: 'ORD-10002', merchantTransactionId: 'MTX-10002',
      amount: pFounder.price, status: 'success', provider: 'manual',
      notes: 'Founder contribution'
    },
  ])

  console.log('✅ Seeding complete.')
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
