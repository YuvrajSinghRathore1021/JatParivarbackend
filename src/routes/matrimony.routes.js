import { Router } from 'express'
import mongoose from 'mongoose'
import { auth } from '../middleware/auth.js'
import { ah } from '../utils/asyncHandler.js'
import { MatrimonyProfile } from '../models/MatrimonyProfile.js'
import { Interest } from '../models/Interest.js'
import { User } from '../models/User.js'

const r = Router()

// List visible profiles (supports ?sort=recent|age-asc|age-desc)
r.get('/profiles', ah(async (req, res) => {
  const { sort = 'recent' } = req.query
  const order =
    sort === 'age-asc' ? { age: 1 } :
      sort === 'age-desc' ? { age: -1 } :
        { createdAt: -1 }

  const profiles = await MatrimonyProfile.find({ visible: true })
    .populate('userId', 'displayName name gender maritalStatus occupation designation department education phone publicNote avatarUrl height currentAddress occupationAddress parentalAddress')
    .sort(order)
    .limit(100)
    .lean()

  const sanitized = profiles.map((p) => {
    const u = p.userId
    return {
      id: p._id,
      age: p.age,
      name: p.name,
      gender: p.gender,
      height: p.height,
      maritalStatus: p.maritalStatus,

      education: p.education,
      department: p?.department,
      designation: p?.designation,
      occupation: p.occupation,
      occupationAddress: p.occupationAddress,
      currentAddress: p.currentAddress,
      parentalAddress: p.parentalAddress,
      location: p.currentAddress,
      gotra: p.gotra,
      photos: p.photos,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      user: u ? {
        id: u._id,
        displayName: u.displayName || u.name,
        occupation: u.occupation,
        designation: u.designation,
        education: u?.education,
        department: u?.department,
        
        gender: u.gender,
        maritalStatus: u.maritalStatus,
        publicNote: u.publicNote,
        avatarUrl: u.avatarUrl,
      } : null,
    }
  })

  res.json(sanitized)
}))

// My profile
r.get('/profiles/me', auth, ah(async (req, res) => {
  const profile = await MatrimonyProfile.findOne({ userId: req.user._id }).lean()
  res.json(profile || null)
}))

r.get('/:id', auth, ah(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid profile id' });
  }
  const profile = await MatrimonyProfile.findById(id).lean();

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
}))

// Upsert my profile
r.post('/profiles', auth, ah(async (req, res) => {
  const body = (({
    age, gender, maritalStatus, education, occupation, department, designation,
    currentAddress, occupationAddress, parentalAddress, gotra, photos, visible, height, name
  }) => ({
    age, gender, maritalStatus, education, occupation, department, designation,
    currentAddress, occupationAddress, parentalAddress, gotra, photos, visible, height, name
  }))(req.body || {})

  const up = await MatrimonyProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { ...body, userId: req.user._id } },
    { new: true, upsert: true }
  )
  res.json(up)
}))

// Delete my profile
r.delete('/profiles', auth, ah(async (req, res) => {
  await MatrimonyProfile.findOneAndDelete({ userId: req.user._id })
  res.json({ success: true })
}))

// Express interest in a user
// r.post('/interest/:toUserId', auth, ah(async (req, res) => {
//   const { toUserId } = req.params
//   if (!mongoose.Types.ObjectId.isValid(toUserId)) {
//     return res.status(400).json({ error: 'Invalid user' })
//   }
//   if (toUserId === String(req.user._id)) {
//     return res.status(400).json({ error: 'Cannot express interest in self' })
//   }

//   const toUser = await User.findById(toUserId).select('_id')
//   if (!toUser) return res.status(404).json({ error: 'User not found' })

//   const item = await Interest.findOneAndUpdate(
//     { fromUserId: req.user._id, toUserId },
//     { $setOnInsert: { status: 'sent' } },
//     { upsert: true, new: true }
//   )
//   res.json(item)
// }))
r.post('/interest/:toUserId', auth, ah(async (req, res) => {
  const toUserId = String(req.params.toUserId)

  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    return res.status(400).json({ error: 'Invalid user' })
  }

  if (toUserId === String(req.user._id)) {
    return res.status(400).json({ error: 'Cannot express interest in self' })
  }

  const item = await Interest.findOneAndUpdate(
    {
      fromUserId: req.user._id,
      toUserId: new mongoose.Types.ObjectId(toUserId), // ✅ convert here
    },
    {
      $setOnInsert: { status: 'sent' },
    },
    { upsert: true, new: true }
  )

  // ✅ convert before sending response
  res.json({
    id: String(item._id),
    fromUserId: String(item.fromUserId),
    toUserId: String(item.toUserId),
    status: item.status,
    createdAt: item.createdAt,
  })
}))


// My incoming/outgoing interests
r.get('/interests/user', auth, ah(async (req, res) => {

  const [incoming, outgoing] = await Promise.all([
    Interest.find({ toUserId: req.user._id })
      .sort('-createdAt')
      .populate('fromUserId', 'displayName name phone occupation designation department education gender maritalStatus avatarUrl publicNote')
      .populate('toUserId', '_id')
      .lean(),
    Interest.find({ fromUserId: req.user._id })
      .sort('-createdAt')
      .populate('toUserId', 'displayName name phone occupation designation department education gender maritalStatus avatarUrl publicNote')
      .lean(),
  ])

  const userIds = [
    ...incoming.map(i => i.fromUserId?._id).filter(Boolean),
    ...outgoing.map(i => i.toUserId?._id).filter(Boolean),
  ]
  const profiles = await MatrimonyProfile.find({ userId: { $in: userIds } }).lean()
  const profileMap = new Map(profiles.map(p => [String(p.userId), p]))

  const serialize = (item, role) => {
    const targetUser = role === 'incoming' ? item.fromUserId : item.toUserId
    if (!targetUser) return null
    const profile = profileMap.get(String(targetUser._id))
    const allowPhone = role === 'incoming' || (role === 'outgoing' && item.status === 'accepted')

    return {
      id: item._id,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      user: {
        id: targetUser._id,
        displayName:  targetUser.name,
        name:  targetUser.name,
        occupation: targetUser.occupation,
        designation: targetUser.designation,
        education: targetUser?.education,
        department: targetUser?.department,
        gender: targetUser.gender,
        maritalStatus: targetUser.maritalStatus,
        publicNote: targetUser.publicNote,
        avatarUrl: targetUser.avatarUrl,
        phone: allowPhone ? targetUser.phone : null,
      },
      profile: profile ? {
        age: profile.age,
        name: profile.name,
        gender: profile.gender,
        maritalStatus: profile.maritalStatus,
        education: profile.education,
        department: profile?.department,
        designation: profile?.designation,
        occupation: profile.occupation,
        location: profile.currentAddress,
        gotra: profile.gotra,
      } : null,
    }
  }

  res.json({
    incoming: incoming.map(i => serialize(i, 'incoming')).filter(Boolean),
    outgoing: outgoing.map(i => serialize(i, 'outgoing')).filter(Boolean),
  })
}))

// Accept an interest
r.post('/interest/:id/accept', auth, ah(async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  const found = await Interest.findOne({ _id: id, toUserId: req.user._id })
  if (!found) return res.status(404).json({ error: 'Interest not found' })
  if (found.status === 'accepted') return res.json(found)

  found.status = 'accepted'
  await found.save()
  res.json(found)
}))

export default r
