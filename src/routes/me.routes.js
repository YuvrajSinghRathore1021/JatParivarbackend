// backend/src/routes/me.routes.js
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { ah } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { Person } from '../models/Person.js'
import { ensurePersonForUser, mapUserRoleToPersonRole } from '../utils/personSync.js'
import { UPLOAD_DIR } from '../utils/uploadDir.js'
import sendOtp from '../utils/sendOtp.js'

const r = Router()
const profileOtpChallenges = new Map()
const profileOtpVerified = new Map()
const PROFILE_OTP_TTL_MS = 5 * 60 * 1000
const PROFILE_OTP_VERIFIED_TTL_MS = 10 * 60 * 1000
const PROFILE_OTP_REQUIRED_ERROR = 'OTP verification required before profile update'

const isLocalUpload = (url) => typeof url === 'string' && url.startsWith('/uploads/')
const profileOtpKey = (user) => String(user?._id || user?.id || '')

const requireVerifiedProfileOtp = (req, res) => {
  const key = profileOtpKey(req.user)
  const record = profileOtpVerified.get(key)
  if (!record) {
    res.status(403).json({ error: PROFILE_OTP_REQUIRED_ERROR })
    return false
  }
  if (Date.now() > record.expiresAt) {
    profileOtpVerified.delete(key)
    res.status(403).json({ error: PROFILE_OTP_REQUIRED_ERROR })
    return false
  }
  return true
}

const consumeVerifiedProfileOtp = (req) => {
  const key = profileOtpKey(req.user)
  profileOtpVerified.delete(key)
}

const deleteLocalUpload = async (url) => {
  if (!isLocalUpload(url)) return
  const fileName = url.replace('/uploads/', '')
  const filePath = path.join(UPLOAD_DIR, fileName)
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Failed to delete old upload', filePath, err)
    }
  }
}

r.post(
  '/profile/otp/start',
  auth,
  ah(async (req, res) => {
    const key = profileOtpKey(req.user)
    const phone = req.user?.phone
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' })
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    profileOtpChallenges.set(key, {
      code,
      expiresAt: Date.now() + PROFILE_OTP_TTL_MS
    })
    profileOtpVerified.delete(key)
    const result = await sendOtp({
      phone,
      otp: code,
      templateId: '208576'
    })
    if (!result.success) {
      return res.status(500).json({
        error: 'OTP sending failed',
        details: result.error
      })
    }
    res.json({ ok: true })
  })
)

r.post(
  '/profile/otp/verify',
  auth,
  ah(async (req, res) => {
    const { code } = req.body || {}
    const normalizedCode = String(code || '').trim()
    if (!/^\d{6}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Invalid OTP' })
    }
    const key = profileOtpKey(req.user)
    const record = profileOtpChallenges.get(key)
    if (!record) {
      return res.status(400).json({ error: 'OTP not found' })
    }
    if (Date.now() > record.expiresAt) {
      profileOtpChallenges.delete(key)
      return res.status(400).json({ error: 'OTP expired' })
    }
    if (record.code !== normalizedCode) {
      return res.status(400).json({ error: 'Invalid OTP' })
    }
    profileOtpChallenges.delete(key)
    profileOtpVerified.set(key, {
      expiresAt: Date.now() + PROFILE_OTP_VERIFIED_TTL_MS
    })
    res.json({ ok: true })
  })
)

r.get(
  '/profile',
  auth,
  ah(async (req, res) => {
    const user = await User.findById(req.user._id).select(
      'name displayName email phone avatarUrl publicNote occupation designation department education gender maritalStatus occupationAddress parentalAddress currentAddress gotra contactEmail alternatePhone referralCode planTitle planAmount role education janAadhaarUrl dateOfBirth status'
    )
    const person = await Person.findOne({ userId: req.user._id })
    res.json({ user, person })
  })
)

r.put(
  '/profile',
  auth,
  ah(async (req, res) => {
    if (!requireVerifiedProfileOtp(req, res)) return
    const body = req.body || {}
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const previousAvatar = user.avatarUrl

    if (body.name !== undefined) user.name = body.name
    if (body.displayName !== undefined) user.displayName = body.displayName
    if (body.occupation !== undefined) user.occupation = body.occupation
    if (body.designation !== undefined) user.designation = body.designation
    if (body.department !== undefined) user.department = body.department
    if (body.publicNote !== undefined) user.publicNote = body.publicNote
    if (body.contactEmail !== undefined) user.contactEmail = body.contactEmail
    if (body.alternatePhone !== undefined) user.alternatePhone = body.alternatePhone
    if (body.gender !== undefined) user.gender = body.gender
    if (body.maritalStatus !== undefined) user.maritalStatus = body.maritalStatus
    if (body.avatarUrl !== undefined) user.avatarUrl = body.avatarUrl
    if (body.janAadhaarUrl !== undefined) user.janAadhaarUrl = body.janAadhaarUrl
    if (body.designation !== undefined) user.designation = body.designation
    if (body.department !== undefined) user.department = body.department
    if (body.education !== undefined) {
      user.education = typeof body.education === 'string'
        ? body.education
        : body.education?.highestQualification || ''
    }
    if (body.gotra !== undefined) user.gotra = sanitizeGotra(body.gotra)
    if (body.occupationAddress !== undefined) user.occupationAddress = sanitizeAddress(body.occupationAddress)
    if (body.parentalAddress !== undefined) user.parentalAddress = sanitizeAddress(body.parentalAddress)
    if (body.currentAddress !== undefined) user.currentAddress = sanitizeAddress(body.currentAddress)


    if (body.dateOfBirth !== undefined) {
      user.dateOfBirth = parseDate(body.dateOfBirth) ?? undefined
    }

    const defaultPersonRole = mapUserRoleToPersonRole(user.role)
    const {
      spotlightRole,
      spotlightTitle,
      spotlightPlace,
      spotlightBioEn,
      spotlightBioHi,
      spotlightBannerUrl,
      spotlightVisible
    } = body

    if (spotlightRole && spotlightRole !== 'none' && spotlightRole !== defaultPersonRole) {
      return res.status(403).json({ error: 'Listing role must match your membership role' })
    }
    if (!defaultPersonRole && spotlightRole && spotlightRole !== 'none') {
      return res.status(403).json({ error: 'Your membership does not allow public listing' })
    }

    await user.save()


    if (defaultPersonRole) {
      const overrides = {
        name: user.displayName || user.name,
        photo: user.avatarUrl,
        place: user.currentAddress?.city,
        publicNote: user.publicNote,
        designation: user.designation,
        department: user.department,
        education: user.education,
        occupation: user.occupation,
        // ✅ MATCH PERSON SCHEMA
        currentAddress: user.currentAddress,
        parentalAddress: user.parentalAddress,
        occupationAddress: user.occupationAddress

      }

      if (spotlightTitle !== undefined) overrides.title = spotlightTitle
      if (spotlightPlace !== undefined) overrides.place = spotlightPlace
      if (spotlightBioEn !== undefined) overrides.bioEn = spotlightBioEn
      if (spotlightBioHi !== undefined) overrides.bioHi = spotlightBioHi
      if (spotlightBannerUrl !== undefined) overrides.bannerUrl = spotlightBannerUrl

      if (spotlightRole === 'none') {
        overrides.visible = false
      } else if (spotlightRole !== undefined) {
        overrides.visible = spotlightVisible !== undefined ? Boolean(spotlightVisible) : true
      } else if (spotlightVisible !== undefined) {
        overrides.visible = Boolean(spotlightVisible)
      }

      await ensurePersonForUser(user, overrides)
    } else {
      await ensurePersonForUser(user)
    }

    if (body.avatarUrl && previousAvatar && previousAvatar !== body.avatarUrl) {
      await deleteLocalUpload(previousAvatar)
    }

    const nextUser = await User.findById(req.user._id).select(
      'name displayName email phone avatarUrl publicNote occupation designation department education gender maritalStatus occupationAddress parentalAddress currentAddress gotra contactEmail alternatePhone referralCode planTitle planAmount role education designation department janAadhaarUrl dateOfBirth status'
    )
    const nextPerson = await Person.findOne({ userId: req.user._id })
    consumeVerifiedProfileOtp(req)
    res.json({ user: nextUser, person: nextPerson })
  })
)

r.put(
  '/profile/avatar',
  auth,
  ah(async (req, res) => {
    if (!requireVerifiedProfileOtp(req, res)) return
    const { avatarUrl } = req.body || {}
    if (avatarUrl !== '' && typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl must be a string' })
    }

    const user = await User.findById(req.user._id).select('avatarUrl displayName name phone planTitle planAmount role occupationAddress parentalAddress currentAddress publicNote')
    if (!user) return res.status(404).json({ error: 'User not found' })

    const previous = user.avatarUrl
    user.avatarUrl = avatarUrl || ''
    await user.save()

    await ensurePersonForUser(user, {
      photo: user.avatarUrl,
      name: user.displayName || user.name,
      place: user.currentAddress?.city,
      publicNote: user.publicNote,
      // ✅ MATCH PERSON SCHEMA
      currentAddress: user.currentAddress,
      parentalAddress: user.parentalAddress,
      occupationAddress: user.occupationAddress

    })

    if (previous && previous !== avatarUrl) {
      await deleteLocalUpload(previous)
    }

    consumeVerifiedProfileOtp(req)
    res.json({
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      name: user.name,
      phone: user.phone,
      planTitle: user.planTitle,
      planAmount: user.planAmount,
      role: user.role,
    })
  })
)

r.put(
  '/profile/password',
  auth,
  ah(async (req, res) => {
    if (!requireVerifiedProfileOtp(req, res)) return
    const { currentPassword, newPassword } = req.body || {}
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' })
    }

    const user = await User.findById(req.user._id).select('passwordHash sessionVersion')
    if (!user) return res.status(404).json({ error: 'User not found' })

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    user.sessionVersion = (user.sessionVersion || 1) + 1
    await user.save()

    consumeVerifiedProfileOtp(req)
    res.json({ ok: true })
  })
)

const sanitizeGotra = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = {}
  if (value.self !== undefined) result.self = value.self
  if (value.mother !== undefined) result.mother = value.mother
  if (value.dadi !== undefined) result.dadi = value.dadi
  if (value.nani !== undefined) result.nani = value.nani
  return Object.keys(result).length ? result : undefined
}

const sanitizeAddress = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = {}
  if (value.state !== undefined) result.state = value.state
  if (value.stateCode !== undefined) result.stateCode = value.stateCode
  if (value.district !== undefined) result.district = value.district
  if (value.districtCode !== undefined) result.districtCode = value.districtCode
  if (value.city !== undefined) result.city = value.city
  if (value.cityCode !== undefined) result.cityCode = value.cityCode
  if (value.village !== undefined) result.village = value.village
  return Object.keys(result).length ? result : undefined
}

const parseDate = (value) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export default r
