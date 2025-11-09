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

const r = Router()

const isLocalUpload = (url) => typeof url === 'string' && url.startsWith('/uploads/')

const deleteLocalUpload = async (url) => {
  if (!isLocalUpload(url)) return
  const fileName = url.replace('/uploads/', '')
  const filePath = path.resolve('src/uploads', fileName)
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Failed to delete old upload', filePath, err)
    }
  }
}

r.get(
  '/profile',
  auth,
  ah(async (req, res) => {
    const user = await User.findById(req.user._id).select(
      'name displayName email phone avatarUrl publicNote occupation company gender maritalStatus address gotra contactEmail alternatePhone referralCode planTitle planAmount role education janAadhaarUrl dateOfBirth status'
    )
    const person = await Person.findOne({ userId: req.user._id })
    res.json({ user, person })
  })
)

r.put(
  '/profile',
  auth,
  ah(async (req, res) => {
    const body = req.body || {}
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const previousAvatar = user.avatarUrl

    if (body.name !== undefined) user.name = body.name
    if (body.displayName !== undefined) user.displayName = body.displayName
    if (body.occupation !== undefined) user.occupation = body.occupation
    if (body.company !== undefined) user.company = body.company
    if (body.publicNote !== undefined) user.publicNote = body.publicNote
    if (body.contactEmail !== undefined) user.contactEmail = body.contactEmail
    if (body.alternatePhone !== undefined) user.alternatePhone = body.alternatePhone
    if (body.gender !== undefined) user.gender = body.gender
    if (body.maritalStatus !== undefined) user.maritalStatus = body.maritalStatus
    if (body.avatarUrl !== undefined) user.avatarUrl = body.avatarUrl
    if (body.janAadhaarUrl !== undefined) user.janAadhaarUrl = body.janAadhaarUrl
    if (body.education !== undefined) user.education = sanitizeEducation(body.education)
    if (body.gotra !== undefined) user.gotra = sanitizeGotra(body.gotra)
    if (body.address !== undefined) user.address = sanitizeAddress(body.address)

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
        place: user.address?.city,
        publicNote: user.publicNote
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
      'name displayName email phone avatarUrl publicNote occupation company gender maritalStatus address gotra contactEmail alternatePhone referralCode planTitle planAmount role education janAadhaarUrl dateOfBirth status'
    )
    const nextPerson = await Person.findOne({ userId: req.user._id })
    res.json({ user: nextUser, person: nextPerson })
  })
)

r.put(
  '/profile/avatar',
  auth,
  ah(async (req, res) => {
    const { avatarUrl } = req.body || {}
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl is required' })
    }

    const user = await User.findById(req.user._id).select('avatarUrl displayName name phone planTitle planAmount role address publicNote')
    if (!user) return res.status(404).json({ error: 'User not found' })

    const previous = user.avatarUrl
    user.avatarUrl = avatarUrl
    await user.save()

    await ensurePersonForUser(user, {
      photo: user.avatarUrl,
      name: user.displayName || user.name,
      place: user.address?.city,
      publicNote: user.publicNote
    })

    if (previous && previous !== avatarUrl) {
      await deleteLocalUpload(previous)
    }

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
  if (value.line1 !== undefined) result.line1 = value.line1
  if (value.line2 !== undefined) result.line2 = value.line2
  if (value.state !== undefined) result.state = value.state
  if (value.district !== undefined) result.district = value.district
  if (value.city !== undefined) result.city = value.city
  if (value.pin !== undefined) result.pin = value.pin
  return Object.keys(result).length ? result : undefined
}

const sanitizeEducation = (value) => {
  if (!value || typeof value !== 'object') return undefined
  const result = {}
  if (value.highestQualification !== undefined) result.highestQualification = value.highestQualification
  if (value.institution !== undefined) result.institution = value.institution
  if (value.year !== undefined) result.year = value.year
  return Object.keys(result).length ? result : undefined
}

const parseDate = (value) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export default r
