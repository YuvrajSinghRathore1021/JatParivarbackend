// backend/src/utils/personSync.js
import { Person } from '../models/Person.js'

const PERSON_ROLE_MAP = {
  founder: 'founder',
  member: 'management'
}

const personFields = [
  'name',
  'title',
  'designation',
  'photo',
  'bannerUrl',
  'place',
  'publicNote',
  'bioEn',
  'bioHi',
  'socials',
  'visible',
  'order'
]

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

const nextOrderForRole = async (role) => {
  const last = await Person.findOne({ role }).sort('-order').select('order').lean()
  if (last && typeof last.order === 'number') {
    return last.order + 1
  }
  return 1
}

export const mapUserRoleToPersonRole = (role) => PERSON_ROLE_MAP[role] || null

export const removePersonForUser = async (userId) => {
  if (!userId) return
  await Person.deleteOne({ userId })
}

/**
 * Ensures the Person document linked to a user is created or updated.
 * Only values provided in `overrides` are updated for existing records.
 * When creating a new Person record, user details are used as defaults.
 *
 * @param {import('../models/User.js').User & {_id: import('mongoose').Types.ObjectId}} user
 * @param {Object} overrides
 * @returns {Promise<import('../models/Person.js').Person|null>}
 */
export const ensurePersonForUser = async (user, overrides = {}) => {
  if (!user?._id) return null

  const personRole = hasOwn(overrides, 'role')
    ? overrides.role
    : mapUserRoleToPersonRole(overrides.userRole || user.role)

  if (!personRole) {
    await removePersonForUser(user._id)
    return null
  }

  let existing = await Person.findOne({ userId: user._id })

  if (!existing) {
    const payload = {
      role: personRole,
      userId: user._id
    }

    for (const field of personFields) {
      if (hasOwn(overrides, field)) {
        payload[field] = overrides[field]
      } else {
        const fallback = getUserFallback(user, field)
        if (fallback !== undefined) {
          payload[field] = fallback
        }
      }
    }

    if (!hasOwn(payload, 'visible')) {
      payload.visible = true
    }
    if (!hasOwn(payload, 'order')) {
      payload.order = await nextOrderForRole(personRole)
    }

    const upsertResult = await Person.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: payload },
      { new: true, upsert: true, rawResult: true }
    )

    existing = upsertResult?.value || null
    const wasExisting = upsertResult?.lastErrorObject?.updatedExisting

    if (!existing) {
      return null
    }

    if (!wasExisting) {
      await cleanupDuplicatePersons(user._id, existing._id)
      return existing
    }
  }

  const toSet = { role: personRole }

  for (const field of personFields) {
    if (hasOwn(overrides, field)) {
      toSet[field] = overrides[field]
    } else {
      const currentValue = typeof existing.get === 'function' ? existing.get(field) : existing[field]
      if ((currentValue === undefined || currentValue === null || currentValue === '') && !hasOwn(overrides, field)) {
        const fallback = getUserFallback(user, field)
        if (fallback !== undefined) {
          toSet[field] = fallback
        }
      }
    }
  }

  existing.set({ ...toSet, userId: user._id })
  await existing.save()
  await cleanupDuplicatePersons(user._id, existing._id)
  return existing
}

function getUserFallback(user, field) {
  switch (field) {
    case 'name':
      return user.displayName || user.name || user.phone || undefined
    case 'photo':
      return user.avatarUrl || undefined
    case 'place':
      return user.address?.city || undefined
    case 'publicNote':
      return user.publicNote || undefined
    default:
      return undefined
  }
}

const cleanupDuplicatePersons = async (userId, keepId) => {
  if (!userId || !keepId) return
  await Person.deleteMany({ userId, _id: { $ne: keepId } })
}

export const pruneDuplicatePersonsForRole = async (role) => {
  if (!role) return
  const docs = await Person.find({ role, userId: { $ne: null } })
    .select('_id userId')
    .sort({ createdAt: 1 })
    .lean()
  const seen = new Set()
  const removeIds = []
  for (const doc of docs) {
    const key = doc.userId?.toString()
    if (!key) continue
    if (seen.has(key)) {
      removeIds.push(doc._id)
    } else {
      seen.add(key)
    }
  }
  if (removeIds.length) {
    await Person.deleteMany({ _id: { $in: removeIds } })
  }
}
