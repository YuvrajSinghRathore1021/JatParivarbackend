import { Router } from 'express'
import mongoose from 'mongoose'
import { Person } from '../models/Person.js'
import { User } from '../models/User.js'
import { AdCampaign } from '../models/AdCampaign.js'
import { Achievement } from '../models/Achievement.js'
import { Plan } from '../models/Plan.js'
import { Page } from '../models/Page.js'
import { ah } from '../utils/asyncHandler.js'

const r = Router()

// Home strips (founders, members, achievements)
r.get('/home/strips', ah(async (_req, res) => {
  const founders = await Person.find({ role: 'founder', visible: true })
    .sort({ order: 1, createdAt: -1 })
    .limit(8)
    .select('name photo designation place')
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

  res.json({ founders, members, achievements })
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
  const { role } = req.query
  const allowedRoles = ['founder', 'management']
  const filter = { visible: true }
  if (role) {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    filter.role = role
  }

  const people = await Person.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .select('role name title place photo bioEn bioHi publicNote userId')
    .lean()

  res.json(people)
}))

// Single person by id
r.get('/people/:id', ah(async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid person id' })
  }
  const person = await Person.findById(id)
    .populate('userId', 'displayName name occupation company publicNote avatarUrl contactEmail phone alternatePhone')
    .lean()

  if (!person || !person.visible) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.json(person)
}))

// Active plans
r.get('/plans', ah(async (_req, res) => {
  const plans = await Plan.find({ active: true })
    .sort({ order: 1, createdAt: 1 })
    .lean()
  res.json(plans)
}))

// CMS pages
r.get('/pages/:slug', ah(async (req, res) => {
  const { slug } = req.params
  const page = await Page.findOne({ slug }).lean()
  if (!page || page.status !== 'published') {
    return res.status(404).json({ error: 'Not found' })
  }
  res.json(page)
}))

export default r
