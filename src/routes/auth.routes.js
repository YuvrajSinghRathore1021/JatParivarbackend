// backend/src/routes/auth.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { Plan } from '../models/Plan.js'
import { Membership } from '../models/Membership.js'
import { ah } from '../utils/asyncHandler.js'
import { signFor } from '../utils/jwt.js'
import { CONFIG, cookieOpts } from '../config/env.js'
import { ensurePersonForUser } from '../utils/personSync.js'
import { generateUniqueReferralCode, isValidReferralCodeFormat, normalizeReferralCode, referralCodeRegex } from '../utils/referral.js'
import { validatePreSignupPayload } from '../utils/preSignupValidation.js'

const r = Router()

r.post('/check-phone', ah(async (req, res) => {
  const { phone } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Phone is required' })
  const exists = await User.exists({ phone })
  res.json({ exists: Boolean(exists) })
}))
// routes/auth.js (or same file where check-phone exists)

r.post('/check-referral', ah(async (req, res) => {
  const { code } = req.body || {}

  // 1️⃣ Required
  if (!code) {
    return res.status(400).json({ error: 'Referral code is required' })
  }

  // 2️⃣ Normalize (important)
  const refCode = normalizeReferralCode(code)

  // 3️⃣ Format validation
  if (!isValidReferralCodeFormat(refCode)) {
    return res.status(400).json({ error: 'Invalid referral code format' })
  }

  // 4️⃣ Check existence
  const exists = await User.exists({ referralCode: referralCodeRegex(refCode) })

  // 5️⃣ Response
  res.json({ exists: Boolean(exists) })
}))

r.post('/register', ah(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const {
    phone,
    form = {},
    addr = {},
    gotra = {},
    profilePhotoUrl,
    plan = 'sadharan',
    refCode,
  } = body

  if (!phone) {
    return res.status(400).json({ error: 'Phone is required' })
  }

  const validation = validatePreSignupPayload(body)
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error })
  }

  const existing = await User.findOne({ phone })
  if (existing) {
    return res.status(409).json({ error: 'User already exists' })
  }

  const planCode = ['founder', 'member', 'sadharan'].includes(plan) ? plan : 'sadharan'
  const planDoc = await Plan.findOne({ code: planCode })
  const planMeta = {
    founder: { role: 'founder', amount: 101000, title: 'Founder' },
    member: { role: 'member', amount: 50000, title: 'Member' },
    sadharan: { role: 'sadharan', amount: 2100, title: 'Sadharan' }
  }[planCode]

  const normalizedRef = normalizeReferralCode(refCode)
  if (!normalizedRef) {
    return res.status(400).json({ error: 'Referral code is required' })
  }
  if (!isValidReferralCodeFormat(normalizedRef)) {
    return res.status(400).json({ error: 'Invalid referral code' })
  }
  const refExists = await User.exists({ referralCode: normalizedRef })
  if (!refExists) {
    return res.status(404).json({ error: 'Referral code not found' })
  }

  const passwordHash = await bcrypt.hash(form.password, 10)

  const referralCode = await generateUniqueReferralCode(User)
  const dateOfBirth = form.dob ? new Date(form.dob) : undefined

  const user = await User.create({
    name: form.name,
    displayName: form.name,
    email: form.email,
    phone,
    passwordHash,
    role: planMeta.role,
    referralCode,
    avatarUrl: validation.profilePhotoUrl,
    occupation: form.occupation,
    designation: form.designation,
    department: form?.department,
    education: form.education,
    gender: form.gender,
    dateOfBirth: Number.isNaN(dateOfBirth?.getTime?.()) ? undefined : dateOfBirth,
    occupationAddress: form.occupationAddress,
    currentAddress: form.currentAddress,
    parentalAddress: form.parentalAddress,
    gotra: {
      self: gotra.self,
      mother: gotra.mother,
      dadi: gotra.dadi,
      nani: gotra.nani
    },
    contactEmail: form.email,
    profession: form.occupation,
    maritalStatus: form.maritalStatus,
    planId: planDoc?._id,
    planTitle: planDoc?.titleEn || planMeta.title,
    planAmount: planDoc?.price || planMeta.amount,
    status: 'active',
    janAadhaarUrl: validation.janAadhaarUrl,
    customFields: normalizedRef ? { referredBy: normalizedRef } : undefined
  })

  await ensurePersonForUser(user, {
    name: user.displayName || user.name,
    photo: user.avatarUrl,
    place: form?.currentAddress?.city || form?.occupationAddress?.city || '',
    publicNote: user.publicNote
  })

  await Membership.create({
    userId: user._id,
    plan: planMeta.role,
    status: 'active',
    startedAt: new Date()
  })

  const token = signFor(user)
  res.cookie('token', token, cookieOpts)
  res.status(201).json({ ok: true, userId: user._id })
}))

r.post('/login', ah(async (req, res) => {
  const { phone, password } = req.body
  const u = await User.findOne({ phone })
  if (!u) return res.status(401).json({ error: 'Invalid' })
  const ok = await u.compare(password)
  if (!ok) return res.status(401).json({ error: 'Invalid' })
  if (!u.referralCode) {
    u.referralCode = await generateUniqueReferralCode(User)
    await u.save()
  }
  const token = signFor(u)
  res.cookie('token', token, cookieOpts)
  res.json({ ok: true })
}))

r.post('/logout', (req, res) => {
  res.clearCookie('token', {
    path: '/',
    sameSite: CONFIG.COOKIE_SAMESITE,
    secure: CONFIG.COOKIE_SECURE
  })
  res.json({ ok: true })
})

r.get('/me', ah(async (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.json({ user: null })
  const { default: jwt } = await import('jsonwebtoken')
  try {
    const dec = jwt.verify(token, CONFIG.JWT_SECRET)
    const u = await User.findById(dec.id).select('-passwordHash')
    res.json({ user: u || null })
  } catch {
    res.json({ user: null })
  }
}))

export default r
