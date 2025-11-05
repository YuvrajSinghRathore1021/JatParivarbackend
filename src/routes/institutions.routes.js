// backend/src/routes/institutions.routes.js
import { Router } from 'express'
import mongoose from 'mongoose'
import { auth } from '../middleware/auth.js'
import { ah } from '../utils/asyncHandler.js'
import { Institution } from '../models/Institution.js'

const r = Router()

r.get(
  '/',
  ah(async (req, res) => {
    const { kind } = req.query
    const list = await Institution.find({ approved: true, ...(kind ? { kind } : {}) })
      .sort('-createdAt')
      .limit(200)
    res.json(list)
  })
)

r.get(
  '/mine',
  auth,
  ah(async (req, res) => {
    const list = await Institution.find({ userId: req.user._id })
      .sort('-createdAt')
    res.json(list)
  })
)

r.post(
  '/',
  auth,
  ah(async (req, res) => {
    const payload = (({
      kind,
      titleEn,
      titleHi,
      descriptionEn,
      descriptionHi,
      addressEn,
      addressHi,
      state,
      district,
      city,
      pin,
      amenities,
      contact,
      images,
    }) => ({
      kind,
      titleEn,
      titleHi,
      descriptionEn,
      descriptionHi,
      addressEn,
      addressHi,
      state,
      district,
      city,
      pin,
      amenities,
      contact,
      images,
    }))(req.body || {})

    const doc = await Institution.create({ ...payload, userId: req.user._id, approved: false })
    res.json(doc)
  })
)

r.patch(
  '/:id',
  auth,
  ah(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid institution id' })
    }

    const payload = (({
      titleEn,
      titleHi,
      descriptionEn,
      descriptionHi,
      addressEn,
      addressHi,
      state,
      district,
      city,
      pin,
      amenities,
      contact,
      images,
    }) => ({
      titleEn,
      titleHi,
      descriptionEn,
      descriptionHi,
      addressEn,
      addressHi,
      state,
      district,
      city,
      pin,
      amenities,
      contact,
      images,
    }))(req.body || {})

    const doc = await Institution.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: payload },
      { new: true }
    )
    if (!doc) {
      return res.status(404).json({ error: 'Listing not found' })
    }
    res.json(doc)
  })
)

export default r
