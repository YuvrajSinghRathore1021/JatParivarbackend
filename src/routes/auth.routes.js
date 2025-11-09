// backend/src/routes/auth.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { User } from '../models/User.js'
import { Plan } from '../models/Plan.js'
import { Membership } from '../models/Membership.js'
import { ah } from '../utils/asyncHandler.js'
import { signFor } from '../utils/jwt.js'
import { CONFIG, cookieOpts } from '../config/env.js'
import { ensurePersonForUser } from '../utils/personSync.js'

const r = Router()

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeReferral = customAlphabet(REFERRAL_ALPHABET, 6)

const generateReferral = async () => {
  for (let i = 0; i < 10; i += 1) {
    const code = makeReferral()
    const taken = await User.exists({ referralCode: code })
    if (!taken) return code
  }
  throw new Error('Could not generate referral code')
}

r.post('/check-phone', ah(async (req, res) => {
  const { phone } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Phone is required' })
  const exists = await User.exists({ phone })
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
  if (!form.password || form.password.length < 6) {
    return res.status(400).json({ error: 'Password is required' })
  }
  if (!form.name) {
    return res.status(400).json({ error: 'Name is required' })
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

  const normalizedRef = typeof refCode === 'string' ? refCode.trim().toUpperCase() : null
  if (normalizedRef && !/^[A-Z0-9]{6}$/.test(normalizedRef)) {
    return res.status(400).json({ error: 'Invalid referral code' })
  }

  if (normalizedRef) {
    const refExists = await User.exists({ referralCode: normalizedRef })
    if (!refExists) {
      return res.status(404).json({ error: 'Referral code not found' })
    }
  }

  const passwordHash = await bcrypt.hash(form.password, 10)

  const referralCode = await generateReferral()
  const dateOfBirth = form.dob ? new Date(form.dob) : undefined
  const education = form.education ? { highestQualification: form.education } : undefined

  const janAadhaarUrlValue =
    [
      body?.janAadhaarUrl,
      body?.janAadharUrl,
      form?.janAadhaarUrl,
      form?.janAadharUrl,
      body?.janAadhaarFileUrl,
      body?.janAadharFileUrl,
    ].find((v) => typeof v === 'string' && v.trim().length > 0) || null

  const user = await User.create({
    name: form.name,
    displayName: form.name,
    email: form.email,
    phone,
    passwordHash,
    role: planMeta.role,
    referralCode,
    avatarUrl: profilePhotoUrl,
    occupation: form.occupation,
    company: form.company,
    gender: form.gender,
    dateOfBirth: Number.isNaN(dateOfBirth?.getTime?.()) ? undefined : dateOfBirth,
    address: {
      line1: addr.line1,
      line2: addr.line2,
      state: addr.state,
      district: addr.district,
      city: addr.city,
      pin: addr.pin
    },
    gotra: {
      self: gotra.self,
      mother: gotra.mother,
      dadi: gotra.dadi,
      nani: gotra.nani
    },
    contactEmail: form.email,
    education,
    profession: form.occupation,
    maritalStatus: form.maritalStatus,
    planId: planDoc?._id,
    planTitle: planDoc?.titleEn || planMeta.title,
    planAmount: planDoc?.price || planMeta.amount,
    status: 'active',
    janAadhaarUrl: janAadhaarUrlValue,
    customFields: normalizedRef ? { referredBy: normalizedRef } : undefined
  })

  await ensurePersonForUser(user, {
    name: user.displayName || user.name,
    photo: user.avatarUrl,
    place: addr.city,
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
