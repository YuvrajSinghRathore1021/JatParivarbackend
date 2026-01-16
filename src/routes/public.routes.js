import { Router } from 'express'
import mongoose from 'mongoose'
import { Person } from '../models/Person.js'
import { User } from '../models/User.js'
import { AdCampaign } from '../models/AdCampaign.js'
import { Achievement } from '../models/Achievement.js'
import { Plan } from '../models/Plan.js'
import { Page } from '../models/Page.js'
import { Setting } from '../models/Setting.js'
import { NewsItem } from '../models/NewsItem.js'
import { HistoryItem } from '../models/HistoryItem.js'
import { ah } from '../utils/asyncHandler.js'
import { ensurePersonForUser, pruneDuplicatePersonsForRole } from '../utils/personSync.js'
import { gauravs } from "../models/GauravPerson.js";

const r = Router()

const PERSON_USER_FIELDS = 'displayName name avatarUrl occupation company publicNote contactEmail phone alternatePhone address planTitle planAmount role status referralCode bussinessurl adimage message'
const ensureRosterForRole = async (personRole) => {
  const normalized = personRole === 'management' ? 'management' : 'founder'
  const userRole = normalized === 'management' ? 'member' : 'founder'
  await pruneDuplicatePersonsForRole(normalized)
  const existing = await Person.find({ role: normalized }).select('userId').lean()
  const existingIds = new Set(
    existing
      .map((doc) => (doc.userId ? doc.userId.toString() : null))
      .filter(Boolean)
  )
  const missing = await User.find({
    role: userRole,
    status: 'active',
    _id: { $nin: Array.from(existingIds) }
  })
  if (missing.length > 0) {
    await Promise.all(missing.map((user) => ensurePersonForUser(user)))
  }
}

const readSetting = async (key, fallback) => {
  const doc = await Setting.findOne({ key })
  return doc ? doc.value : fallback
}

const serializePublicPerson = (doc) => {
  if (!doc) return null
  const user = doc.userId || doc.user || null
  return {
    id: doc._id,
    role: doc.role,
    name: doc.name,
    title: doc.title,
    designation: doc.designation,
    photo: doc.photo || user?.avatarUrl || null,
    bannerUrl: doc.bannerUrl || null,
    place: doc.place || user?.address?.city || null,
    publicNote: doc.publicNote || user?.publicNote || null,
    bioEn: doc.bioEn,
    bioHi: doc.bioHi,
    visible: doc.visible,
    order: doc.order,
    socials: doc.socials,
    bussinessurl: user?.bussinessurl || null,
    adimage: user?.adimage || null,
    message: user?.message || null,
    user: user
      ? {
        id: user._id,
        displayName: user.displayName,
        name: user.name,
        avatarUrl: user.avatarUrl,
        occupation: user.occupation,
        company: user.company,
        publicNote: user.publicNote,
        contactEmail: user.contactEmail,
        phone: user.phone,
        alternatePhone: user.alternatePhone,
        address: user.address,
        role: user.role,
        planTitle: user.planTitle,
        planAmount: user.planAmount,
        status: user.status,
        referralCode: user.referralCode,
      }
      : null,
  }
}

const dedupePeopleByUser = (docs) => {
  const seen = new Set()
  const result = []
  for (const doc of docs) {
    const userId = doc.userId ? doc.userId._id?.toString?.() || doc.userId.toString?.() : null
    if (userId) {
      if (seen.has(userId)) continue
      seen.add(userId)
    }
    result.push(doc)
  }
  return result
}

// Home strips (founders, members, achievements)
r.get('/home/strips', ah(async (_req, res) => {
  await ensureRosterForRole('founder')
  await ensureRosterForRole('management')
  const populate = { path: 'userId', select: PERSON_USER_FIELDS }
  const founders = await Person.find({ role: 'founder', visible: true })
    .sort({ order: 1, createdAt: -1 })
    .limit(10)
    .populate(populate)
    .lean()

  const management = await Person.find({ role: 'management', visible: true })
    .sort({ order: 1, createdAt: -1 })
    .limit(10)
    .populate(populate)
    .lean()

  const members = await User.find({ role: 'member', status: 'active' })
    .sort('-createdAt')
    .limit(12)
    .select('name displayName avatarUrl occupation company planTitle planAmount')
    .lean()

  const achievements = await Achievement.find({ active: true })
    .sort({ order: 1, createdAt: -1 })
    .select('textEn textHi order')
    .lean()

  res.json({
    founders: founders.map((doc) => ({
      id: doc._id,
      name: doc.name,
      title: doc.title,
      designation: doc.designation,
      photo: doc.photo || doc.userId?.avatarUrl || null,
      place: doc.place || doc.userId?.address?.city || null,
      order: doc.order
    })),
    management: management.map((doc) => ({
      id: doc._id,
      name: doc.name,
      title: doc.title,
      designation: doc.designation,
      photo: doc.photo || doc.userId?.avatarUrl || null,
      place: doc.place || doc.userId?.address?.city || null,
      order: doc.order
    })),
    members,
    achievements
  })
}))

// One active ad by variant
r.get('/ads', ah(async (req, res) => {
  const { variant = 'billboard' } = req.query
  const now = new Date()
  const ad = await AdCampaign.findOne({
    variant,
    active: true,
    $and: [
      { $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  }).sort('-updatedAt').lean()

  res.json(ad || { active: false })
}))

// Members list
r.get('/members', ah(async (_req, res) => {
  const q = await User.find({ role: 'member', status: 'active' })
    .select('name displayName avatarUrl occupation company planTitle planAmount')
    .limit(200)
    .lean()
  res.json(q)
}))

// Founders/Management people
r.get('/people', ah(async (req, res) => {
  const { role, limit } = req.query
  const allowedRoles = ['founder', 'management']
  const filter = { visible: true }
  if (role) {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    filter.role = role
  }

  if (filter.role) {
    await ensureRosterForRole(filter.role)
  } else {
    await ensureRosterForRole('founder')
    await ensureRosterForRole('management')
  }

  const q = Person.find(filter).sort({ order: 1, createdAt: -1 }).populate({ path: 'userId', select: PERSON_USER_FIELDS })
  const parsedLimit = parseInt(limit, 10)
  if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
    q.limit(parsedLimit)
  }

  const people = await q.lean()
  res.json(dedupePeopleByUser(people).map(serializePublicPerson))
}))

// Single person by id
r.get('/people/:id', ah(async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid person id' })
  }
  const person = await Person.findById(id)
    .populate({ path: 'userId', select: PERSON_USER_FIELDS })
    .lean()

  if (!person || !person.visible) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.json(serializePublicPerson(person))
}))


r.get('/user/:id', ah(async (req, res) => {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user id' })
  }

  // 1️⃣ Get user
  const user = await User.findById(id).lean()

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({
    person: user || null
  })
}))


// History timeline
r.get('/history', ah(async (req, res) => {
  const { category = 'history' } = req.query
  const filter = { published: true }
  if (category) filter.category = category
  const items = await HistoryItem.find(filter)
    .sort({ order: 1, year: 1, createdAt: -1 })
    .lean()
  res.json(items.map((item) => ({
    id: item._id,
    category: item.category,
    year: item.year,
    order: item.order,
    titleEn: item.titleEn,
    titleHi: item.titleHi,
    bodyEn: item.bodyEn,
    bodyHi: item.bodyHi,
    imageUrl: item.imageUrl
  })))
}))


// routes/public/history.js

r.get('/history/:id', ah(async (req, res) => {
  const { id } = req.params;

  const item = await HistoryItem.findById(id).lean();
  if (!item) return res.status(404).json({ error: "Not found" });

  res.json({
    id: item._id,
    category: item.category,
    year: item.year,
    order: item.order,
    titleEn: item.titleEn,
    titleHi: item.titleHi,
    bodyEn: item.bodyEn,
    bodyHi: item.bodyHi,
    imageUrl: item.imageUrl,
    bannerUrl: item.bannerUrl || item.imageUrl,
    place: item.place,
    createdAt: item.createdAt
  });
}));

// Community news listing
r.get('/news', ah(async (_req, res) => {
  const items = await NewsItem.find({ published: true })
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean()
  res.json(items.map((item) => ({
    id: item._id,
    slug: item.slug,
    titleEn: item.titleEn,
    titleHi: item.titleHi,
    excerptEn: item.excerptEn,
    excerptHi: item.excerptHi,
    heroImageUrl: item.heroImageUrl,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt
  })))
}))

r.get('/news/:slug', ah(async (req, res) => {
  const item = await NewsItem.findOne({ slug: req.params.slug, published: true }).lean()
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json({
    id: item._id,
    slug: item.slug,
    titleEn: item.titleEn,
    titleHi: item.titleHi,
    excerptEn: item.excerptEn,
    excerptHi: item.excerptHi,
    bodyEn: item.bodyEn,
    bodyHi: item.bodyHi,
    heroImageUrl: item.heroImageUrl,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt
  })
}))

// Active plans
r.get('/plans', ah(async (_req, res) => {
  const plans = await Plan.find({ active: true })
    .sort({ order: 1, createdAt: 1 })
    .lean()
  res.json(plans)
}))

// Footer info
r.get('/site/footer', ah(async (_req, res) => {
  const contact = await readSetting('site.contact', {
    addressLine1: '',
    addressLine2: '',
    phone: '',
    email: ''
  })
  const socials = await readSetting('site.socials', [])
  const footerLinks = await readSetting('site.footerLinks', { quick: [], secondary: [] })
  res.json({ contact, socials, footerLinks })
}))

// Home impact + milestones section
r.get('/site/home-impact', ah(async (_req, res) => {
  const impact = await readSetting('site.home.impact', { stats: [], milestones: [] })
  res.json(impact)
}))

// // CMS pages
// r.get('/pages/:slug', ah(async (req, res) => {
//   const { slug } = req.params
//   const page = await Page.findOne({ slug }).lean()
//   if (!page || page.status !== 'published') {
//     return res.status(404).json({ error: 'Not found' })
//   }
//   res.json(page)
// }))

// CMS pages
r.get('/pages/:slug', ah(async (req, res) => {
  const { slug } = req.params
  const page = await Page.findOne({ slug }).lean()
  if (!page || page.status !== 'published') {
    return res.status(404).json({ error: 'Not found' })
  }
  res.json(page)
}))





// r.get("/gaurav", async (req, res) => {
//   const {
//     search = "",
//     timeline,
//     category,
//     id
//   } = req.query;

//   // ----------------------------------------
//   // 1) If ID exists → return single profile
//   // ----------------------------------------
//   if (id) {
//     const item = await gauravs.findById(id).lean();

//     if (!item) {
//       return res.status(404).json({ error: "Profile not found" });
//     }

//     return res.json({ data: item });
//   }

//   // ----------------------------------------
//   // 2) Otherwise → return list with filters
//   // ----------------------------------------
//   const filter = {};

//   if (timeline) filter.timeline = timeline;
//   if (category) filter.category = category;

//   if (search) {
//     filter.$or = [
//       { name: new RegExp(search, "i") },
//       { title: new RegExp(search, "i") },
//       { biography: new RegExp(search, "i") }
//     ];
//   }

//   const list = await gauravs
//     .find(filter)
//     .sort({ createdAt: -1 })
//     .lean();

//   res.json({ data: list });
// });



r.get("/gaurav", async (req, res) => {
  const { search = "", timeline, category, id } = req.query;

  // -----------------------------------------------------
  // 1) If ID exists → return single profile
  // -----------------------------------------------------
  if (id) {
    try {
      const item = await gauravs.findById(id).lean();

      if (!item) {
        return res.status(404).json({ error: "Profile not found" });
      }

      return res.json({ data: item });
    } catch (err) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
  }

  // -----------------------------------------------------
  // 2) Build Filter for List Results
  // -----------------------------------------------------
  const filter = {};

  // Filter by timeline (searching inside nested sections)
  if (timeline === "PRESENT") {
    filter["data.timeline"] = "PRESENT";
  }

  if (timeline === "PAST") {
    filter["data.timeline"] = "PAST";
  }

  // Filter by category (nested)
  if (category) {
    filter.$or = [
      { "data.category": category }
    ];
  }

  // Search across name, title, biography (both sections)
  if (search) {
    const regex = new RegExp(search, "i");

    filter.$or = [
      { name: regex },
      { title: regex },
      { "data.biography": regex }
    ];
  }

  // -----------------------------------------------------
  // 3) Get List
  // -----------------------------------------------------
  const list = await gauravs
    .find(filter)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ data: list });
});





// r.get('/foundpeople', ah(async (req, res) => {
//   const { role, limit, state, district, city, gotra, occupation } = req.query
//   const filter = { visible: true }

//   const q = Person.find(filter).sort({ order: 1, createdAt: -1 }).populate({ path: 'userId', select: PERSON_USER_FIELDS })
//   const parsedLimit = parseInt(limit, 10)
//   if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
//     q.limit(parsedLimit)
//   }

//   const people = await q.lean()
//   res.json(dedupePeopleByUser(people).map(serializePublicPerson))
// }))


r.get('/foundpeople', ah(async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    state, district, city, gotra, occupation, search, status, role,
    from, to,
    sortBy = 'createdAt',
    sortDir = 'desc'
  } = req.query

  const parsedPage = Math.max(1, parseInt(page, 10) || 1)
  const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

  const filter = {}
  if (search) {
    const regex = new RegExp(search, 'i')
    filter.$or = [
      { name: regex },

      { alternatePhone: regex },
      { referralCode: regex },
      { 'gotra.self': regex },

    ]
  }
  if (status) filter.status = status
  if (role) filter.role = role
  if (state) filter['currentAddress.stateCode'] = state
  if (district) filter['currentAddress.districtCode'] = district
  if (city) filter['currentAddress.cityCode'] = city
  if (gotra) filter['gotra.self'] = gotra
  if (occupation) filter['occupation'] = occupation
  // if (from || to) {
  //   filter.createdAt = {}
  //   if (from) filter.createdAt.$gte = new Date(from)
  //   if (to) filter.createdAt.$lte = new Date(to)
  // }

  const allowedSortBy = new Set(['createdAt', 'name', 'role'])
  const sortField = allowedSortBy.has(sortBy) ? sortBy : 'createdAt'
  const sortOrder = sortDir === 'asc' ? 1 : -1
  const sort = { [sortField]: sortOrder }
  if (sortField !== 'createdAt') {
    sort.createdAt = -1
  }

  const skip = (parsedPage - 1) * parsedPageSize

  const [data, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parsedPageSize),
    User.countDocuments(filter)
  ])

  res.json({
    data: data.map(serializeUser),
    meta: {
      total,
      page: parsedPage,
      pageSize: parsedPageSize,
      sortBy: sortField,
      sortDir: sortOrder === 1 ? 'asc' : 'desc'
    }
  })
}))



const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  displayName: user.displayName,
  email: user.email,



  role: user.role,
  gender: user.gender,
  maritalStatus: user.maritalStatus,

  occupationAddress: user.occupationAddress,
  currentAddress: user.currentAddress,
  parentalAddress: user.parentalAddress,
  gotra: user.gotra,
  occupation: user.occupation,
  company: user.company,

  avatarUrl: user.avatarUrl,
  contactEmail: user.contactEmail,
  publicNote: user.publicNote,

  bussinessurl: user.bussinessurl,
  adimage: user.adimage,
  message: user.message,

  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

export default r
