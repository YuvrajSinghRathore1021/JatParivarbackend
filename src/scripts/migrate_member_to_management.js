// backend/src/scripts/migrate_member_to_management.js
// One-time migration to rename legacy "member" role/plan -> "management".
import mongoose from 'mongoose'
import { CONFIG } from '../config/env.js'
import { User } from '../models/User.js'
import { PreSignup } from '../models/PreSignup.js'
import { Membership } from '../models/Membership.js'
import { Plan } from '../models/Plan.js'
import { Payment } from '../models/Payment.js'

const log = (...args) => console.log('[migrate_member_to_management]', ...args)

const run = async () => {
  if (!CONFIG.MONGO_URI) {
    throw new Error('MONGO_URI missing in environment')
  }

  await mongoose.connect(CONFIG.MONGO_URI)
  log('Connected')

  const mgmtPlan = await Plan.findOne({ code: 'management' }).lean()
  const memberPlan = await Plan.findOne({ code: 'member' }).lean()

  if (!mgmtPlan && memberPlan) {
    log('Renaming Plan code "member" -> "management"')
    await Plan.updateOne(
      { _id: memberPlan._id },
      { $set: { code: 'management', titleEn: memberPlan.titleEn === 'Member' ? 'Management' : memberPlan.titleEn } }
    )
  } else if (mgmtPlan && memberPlan) {
    log('Both plans exist; moving references from member plan to management plan')
    await Promise.all([
      User.updateMany({ planId: memberPlan._id }, { $set: { planId: mgmtPlan._id, planTitle: mgmtPlan.titleEn } }),
      Payment.updateMany({ planId: memberPlan._id }, { $set: { planId: mgmtPlan._id } }),
    ])
    log('Deleting legacy member plan')
    await Plan.deleteOne({ _id: memberPlan._id })
  } else {
    log('Plan check ok')
  }

  const [users, pres, memberships] = await Promise.all([
    User.updateMany({ role: 'member' }, { $set: { role: 'management' } }),
    PreSignup.updateMany({ plan: 'member' }, { $set: { plan: 'management' } }),
    Membership.updateMany({ plan: 'member' }, { $set: { plan: 'management' } }),
  ])

  log('Updated users:', users.modifiedCount ?? users.nModified ?? 0)
  log('Updated presignups:', pres.modifiedCount ?? pres.nModified ?? 0)
  log('Updated memberships:', memberships.modifiedCount ?? memberships.nModified ?? 0)

  await mongoose.disconnect()
  log('Done')
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

