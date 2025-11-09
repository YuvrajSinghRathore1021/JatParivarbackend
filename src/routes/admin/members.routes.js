// backend/src/routes/admin/members.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { User } from '../../models/User.js'
import { Payment } from '../../models/Payment.js'
import { Person } from '../../models/Person.js'
import { Plan } from '../../models/Plan.js'
import { Membership } from '../../models/Membership.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'
import { ensurePersonForUser, mapUserRoleToPersonRole } from '../../utils/personSync.js'

const router = Router()

const ALLOWED_MEMBER_ROLES = new Set(['sadharan', 'member', 'founder', 'admin'])

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  displayName: user.displayName,
  email: user.email,
  phone: user.phone,
  alternatePhone: user.alternatePhone,
  status: user.status,
  referralCode: user.referralCode,
  planId: user.planId,
  planTitle: user.planTitle,
  planAmount: user.planAmount,
  role: user.role,
  gender: user.gender,
  maritalStatus: user.maritalStatus,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  gotra: user.gotra,
  occupation: user.occupation,
  company: user.company,
  education: user.education,
  avatarUrl: user.avatarUrl,
  contactEmail: user.contactEmail,
  publicNote: user.publicNote,
  janAadhaarUrl: user.janAadhaarUrl,
  documents: user.documents,
  customFields: user.customFields,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

const serializePerson = (person) => person ? ({
  id: person._id,
  role: person.role,
  name: person.name,
  title: person.title,
  designation: person.designation,
  photo: person.photo,
  bannerUrl: person.bannerUrl,
  place: person.place,
  publicNote: person.publicNote,
  bioEn: person.bioEn,
  bioHi: person.bioHi,
  visible: person.visible,
  order: person.order,
  socials: person.socials
}) : null

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    role,
    state,
    city,
    from,
    to,
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
      { displayName: regex },
      { email: regex },
      { phone: regex },
      { alternatePhone: regex },
      { referralCode: regex },
      { 'gotra.self': regex },
      { 'gotra.mother': regex },
      { 'gotra.dadi': regex },
      { 'gotra.nani': regex }
    ]
  }
  if (status) filter.status = status
  if (role) filter.role = role
  if (state) filter['address.state'] = state
  if (city) filter['address.city'] = city
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

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

router.get('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'Member not found' })
  const payments = await Payment.find({ $or: [{ userId: user._id }, { preSignupId: user._id }] }).sort('-createdAt')
  let person = await Person.findOne({ userId: user._id })
  if (!person && mapUserRoleToPersonRole(user.role)) {
    person = await ensurePersonForUser(user)
  }
  res.json({ member: serializeUser(user), person: serializePerson(person), payments })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  const { name, phone, password } = body

  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone, and password are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  const existing = await User.findOne({ phone })
  if (existing) {
    return res.status(400).json({ error: 'Phone already in use' })
  }

  const referralCode = await generateReferral()
  const memberRole = ALLOWED_MEMBER_ROLES.has(body.role) ? body.role : 'sadharan'
  const plan = memberRole ? await Plan.findOne({ code: memberRole }) : null

  const userPayload = cleanObject({
    name,
    displayName: body.displayName || name,
    email: body.email,
    phone,
    alternatePhone: body.alternatePhone,
    status: body.status || 'active',
    role: memberRole,
    gender: body.gender,
    maritalStatus: body.maritalStatus,
    contactEmail: body.contactEmail || body.email,
    publicNote: body.publicNote,
    occupation: body.occupation,
    company: body.company,
    avatarUrl: body.avatarUrl,
    janAadhaarUrl: body.janAadhaarUrl,
    planId: plan?._id,
    planTitle: plan?.titleEn || body.planTitle,
    planAmount: plan?.price || body.planAmount,
    referralCode,
    gotra: sanitizeGotra(body.gotra),
    address: sanitizeAddress(body.address),
    education: sanitizeEducation(body.education),
    dateOfBirth: parseDate(body.dateOfBirth),
    passwordHash: await bcrypt.hash(password, 10)
  })

  const user = await User.create(userPayload)

  await ensurePersonForUser(user, {
    name: userPayload.displayName || userPayload.name,
    photo: userPayload.avatarUrl,
    place: userPayload.address?.city,
    publicNote: userPayload.publicNote
  })

  await logAudit({
    admin: req.admin,
    entityType: 'member',
    entityId: user._id,
    action: 'create',
    summary: `Created member ${user.name}`,
    after: serializeUser(user)
  })

  res.status(201).json({ member: serializeUser(user) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'Member not found' })

  const body = req.body || {}
  if (body.referralCode) delete body.referralCode

  if (body.phone && body.phone !== user.phone) {
    const taken = await User.findOne({ phone: body.phone, _id: { $ne: user._id } })
    if (taken) {
      return res.status(400).json({ error: 'Phone already in use' })
    }
  }

  const updates = cleanObject({
    name: body.name,
    displayName: body.displayName,
    email: body.email,
    phone: body.phone,
    alternatePhone: body.alternatePhone,
    status: body.status,
    role: body.role,
    gender: body.gender,
    maritalStatus: body.maritalStatus,
    contactEmail: body.contactEmail,
    publicNote: body.publicNote,
    occupation: body.occupation,
    company: body.company,
    avatarUrl: body.avatarUrl,
    janAadhaarUrl: body.janAadhaarUrl,
    planTitle: body.planTitle,
    planAmount: body.planAmount,
    gotra: sanitizeGotra(body.gotra),
    address: sanitizeAddress(body.address),
    education: sanitizeEducation(body.education),
    dateOfBirth: parseDate(body.dateOfBirth)
  })

  if (body.role) {
    if (!ALLOWED_MEMBER_ROLES.has(body.role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    const plan = await Plan.findOne({ code: body.role })
    updates.planId = plan?._id || null
    updates.planTitle = plan?.titleEn || updates.planTitle
    updates.planAmount = plan?.price ?? updates.planAmount
  } else if (body.planId) {
    const plan = await Plan.findById(body.planId)
    updates.planId = plan?._id || null
    updates.planTitle = plan?.titleEn || updates.planTitle
    updates.planAmount = plan?.price ?? updates.planAmount
  }

  if (body.password) {
    if (body.password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    updates.passwordHash = await bcrypt.hash(body.password, 10)
  }

  const before = serializeUser(user)

  Object.assign(user, updates)
  await user.save()

  await ensurePersonForUser(user, {
    name: user.displayName || user.name,
    photo: user.avatarUrl,
    place: user.address?.city,
    publicNote: user.publicNote
  })

  await logAudit({
    admin: req.admin,
    entityType: 'member',
    entityId: user._id,
    action: 'update',
    summary: `Updated member ${user.name}`,
    before,
    after: serializeUser(user)
  })

  res.json({ member: serializeUser(user) })
}))

router.patch('/:id/status', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'Member not found' })
  const { status } = req.body
  if (!['active', 'disabled', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const before = serializeUser(user)
  user.status = status
  await user.save()

  await ensurePersonForUser(user, {
    name: user.displayName || user.name,
    photo: user.avatarUrl,
    place: user.address?.city,
    publicNote: user.publicNote
  })

  await logAudit({
    admin: req.admin,
    entityType: 'member',
    entityId: user._id,
    action: 'status',
    summary: `Changed status to ${status}`,
    before,
    after: serializeUser(user)
  })
  res.json({ member: serializeUser(user) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'Member not found' })

  const before = serializeUser(user)
  await Promise.all([
    Person.deleteOne({ userId: user._id }),
    Membership.deleteMany({ userId: user._id }),
    user.deleteOne()
  ])

  await logAudit({
    admin: req.admin,
    entityType: 'member',
    entityId: user._id,
    action: 'delete',
    summary: `Deleted member ${user.name}`,
    before
  })

  res.status(204).end()
}))

const sanitizeGotra = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = cleanObject({
    self: value.self,
    mother: value.mother,
    dadi: value.dadi,
    nani: value.nani
  })
  return result && Object.keys(result).length > 0 ? result : undefined
}

const sanitizeAddress = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = cleanObject({
    line1: value.line1,
    line2: value.line2,
    state: value.state,
    district: value.district,
    city: value.city,
    pin: value.pin
  })
  return result && Object.keys(result).length > 0 ? result : undefined
}

const sanitizeEducation = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = cleanObject({
    highestQualification: value.highestQualification,
    institution: value.institution,
    year: value.year
  })
  return result && Object.keys(result).length > 0 ? result : undefined
}

const parseDate = (value) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return undefined
  const result = {}
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value
    }
  })
  return result
}

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeReferral = customAlphabet(REFERRAL_ALPHABET, 6)

const generateReferral = async () => {
  let code
  let exists = true
  while (exists) {
    code = makeReferral()
    exists = await User.exists({ referralCode: code })
  }
  return code
}

export default router
