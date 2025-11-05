// backend/src/routes/admin/members.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { User } from '../../models/User.js'
import { Payment } from '../../models/Payment.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'
import { Plan } from '../../models/Plan.js'

const router = Router()

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  displayName: user.displayName,
  email: user.email,
  phone: user.phone,
  status: user.status,
  referralCode: user.referralCode,
  planId: user.planId,
  planTitle: user.planTitle,
  planAmount: user.planAmount,
  role: user.role, // <-- role is already here, perfect
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  gotra: user.gotra,
  occupation: user.occupation,
  education: user.education,
  avatarUrl: user.avatarUrl,
  janAadhaarUrl: user.janAadhaarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    // --- MODIFIED --- 'plan' query param removed
    role,
    state,
    city,
    from,
    to
  } = req.query

  const filter = {}
  if (search) {
    const regex = new RegExp(search, 'i')
    filter.$or = [
      { name: regex },
      { displayName: regex },
      { email: regex },
      { phone: regex },
      { 'gotra.self': regex },
      { 'gotra.mother': regex }
    ]
  }
  if (status) filter.status = status
  // --- MODIFIED --- 'if (plan)' block removed, 'if (role)' block is already correct
  if (role) filter.role = role
  if (state) filter['address.state'] = state
  if (city) filter['address.city'] = city
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10)
  const [data, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(parseInt(pageSize, 10)),
    User.countDocuments(filter)
  ])

  res.json({
    data: data.map(serializeUser),
    meta: {
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10)
    }
  })
}))

router.get('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ error: 'Member not found' })
  const payments = await Payment.find({ $or: [{ userId: user._id }, { preSignupId: user._id }] }).sort('-createdAt')
  res.json({ member: serializeUser(user), payments })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.phone || !body.name) {
    return res.status(400).json({ error: 'Name and phone required' })
  }
  if (await User.findOne({ phone: body.phone })) {
    return res.status(400).json({ error: 'Phone already in use' })
  }
  const referralCode = await generateReferral()
  const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined

  // --- MODIFIED ---
  // Find the plan by its 'code' (which we assume matches the role string)
  // This will populate planId, planTitle, and planAmount automatically
  const plan = body.role ? await Plan.findOne({ code: body.role }) : null
  
  const user = await User.create({
    ...body,
    referralCode,
    passwordHash,
    planId: plan?._id, // Set planId from the found plan
    planTitle: plan?.titleEn, // Set planTitle from the found plan
    planAmount: plan?.price // Set planAmount from the found plan
  })
  // --- END MODIFICATION ---
  
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
  const before = serializeUser(user)
  const updates = { ...req.body }
  if (updates.referralCode) delete updates.referralCode

  // --- MODIFIED ---
  // If the role is being updated, we also update the planId, planTitle, and planAmount
  if (updates.role) {
    const plan = await Plan.findOne({ code: updates.role })
    updates.planId = plan?._id
    updates.planTitle = plan?.titleEn
    updates.planAmount = plan?.price
  } else if (updates.planId) {
    // Keep old logic just in case planId is updated some other way
    const plan = await Plan.findById(updates.planId)
    updates.planTitle = plan?.titleEn
    updates.planAmount = plan?.price
  }
  // --- END MODIFICATION ---

  Object.assign(user, updates)
  await user.save()
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