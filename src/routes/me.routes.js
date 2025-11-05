// backend/src/routes/me.routes.js
import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { ah } from '../utils/asyncHandler.js'
import { User } from '../models/User.js'
import { Person } from '../models/Person.js'

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
      'name displayName email phone avatarUrl publicNote occupation company gender maritalStatus address gotra contactEmail alternatePhone referralCode planTitle planAmount role'
    )
    const person = await Person.findOne({ userId: req.user._id })
    res.json({ user, person })
  })
)

r.put(
  '/profile',
  auth,
  ah(async (req, res) => {
    const allow = (({
      displayName,
      occupation,
      company,
      avatarUrl,
      publicNote,
      contactEmail,
      alternatePhone,
    }) => ({
      displayName,
      occupation,
      company,
      avatarUrl,
      publicNote,
      contactEmail,
      alternatePhone,
    }))(req.body || {})

    const sanitized = Object.fromEntries(
      Object.entries(allow).filter(([, value]) => value !== undefined)
    )

    const previous = await User.findById(req.user._id).select('avatarUrl role')

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: sanitized },
      { new: true }
    ).select(
      'name displayName email phone avatarUrl publicNote occupation company gender maritalStatus address gotra contactEmail alternatePhone referralCode planTitle planAmount role'
    )

    const {
      spotlightRole,
      spotlightTitle,
      spotlightPlace,
      spotlightBioEn,
      spotlightBioHi,
      spotlightVisible,
    } = req.body || {}

    let person = await Person.findOne({ userId: req.user._id })

    if (spotlightRole) {
      if (!['founder', 'management'].includes(spotlightRole)) {
        return res.status(400).json({ error: 'Invalid spotlight role' })
      }

      if (spotlightRole === 'founder' && previous?.role !== 'founder' && previous?.role !== 'admin') {
        return res.status(403).json({ error: 'Founder spotlight requires founder membership' })
      }

      const payload = {
        role: spotlightRole,
        name: user.displayName || user.name,
        title: spotlightTitle,
        place: spotlightPlace,
        bioEn: spotlightBioEn,
        bioHi: spotlightBioHi,
        publicNote: user.publicNote,
        photo: user.avatarUrl,
        visible: spotlightVisible !== false,
        userId: req.user._id,
      }

      person = await Person.findOneAndUpdate(
        { userId: req.user._id },
        { $set: payload },
        { upsert: true, new: true }
      )
    } else if (person) {
      await person.deleteOne()
      person = null
    }

    if (sanitized.avatarUrl && previous?.avatarUrl && previous.avatarUrl !== sanitized.avatarUrl) {
      await deleteLocalUpload(previous.avatarUrl)
    }

    res.json({ user, person })
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

    const user = await User.findById(req.user._id).select('avatarUrl displayName name phone planTitle planAmount role')
    if (!user) return res.status(404).json({ error: 'User not found' })

    const previous = user.avatarUrl
    user.avatarUrl = avatarUrl
    await user.save()

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

export default r
