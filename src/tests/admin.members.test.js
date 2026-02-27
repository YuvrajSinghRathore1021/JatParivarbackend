import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import { CONFIG } from '../config/env.js'
import { adminAuth } from '../middleware/adminAuth.js'
import membersRoutes from '../routes/admin/members.routes.js'

import { Admin } from '../models/Admin.js'
import { Plan } from '../models/Plan.js'
import { Person } from '../models/Person.js'
import { User } from '../models/User.js'
import { ensurePersonForUser } from '../utils/personSync.js'

const signAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id.toString(), sessionVersion: admin.sessionVersion },
    CONFIG.ADMIN_JWT_SECRET || CONFIG.JWT_SECRET
  )

let app
let token

test.before(async () => {
  await startMongo()
  app = express()
  app.use(express.json())
  app.use('/api/v1/admin/members', adminAuth, membersRoutes)
})

test.after(async () => {
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()

  await Plan.create([
    { code: 'founder', titleEn: 'Founder', price: 101000 },
    { code: 'management', titleEn: 'Management', price: 50000 },
    { code: 'sadharan', titleEn: 'Sadharan', price: 2100 },
  ])

  const admin = await Admin.create({
    phone: '9990000000',
    name: 'Test Admin',
    passwordHash: 'x',
    roles: ['SUPER_ADMIN'],
    status: 'active',
    sessionVersion: 1,
  })
  token = signAdminToken(admin)
})

test('admin can promote sadharan -> founder and creates Person roster', async () => {
  const user = await User.create({
    name: 'User One',
    displayName: 'User One',
    phone: '9000000001',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
  })

  const res = await request(app)
    .patch(`/api/v1/admin/members/${user._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'founder' })
    .expect(200)

  assert.equal(res.body?.member?.role, 'founder')

  const person = await Person.findOne({ userId: user._id }).lean()
  assert.ok(person)
  assert.equal(person.role, 'founder')
})

test('admin can demote founder -> sadharan and removes Person roster', async () => {
  const user = await User.create({
    name: 'User Two',
    displayName: 'User Two',
    phone: '9000000002',
    passwordHash: 'x',
    role: 'founder',
    status: 'active',
  })

  await ensurePersonForUser(user)
  const existing = await Person.findOne({ userId: user._id }).lean()
  assert.ok(existing, 'expected initial Person to exist')

  const res = await request(app)
    .patch(`/api/v1/admin/members/${user._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'sadharan' })
    .expect(200)

  assert.equal(res.body?.member?.role, 'sadharan')

  const person = await Person.findOne({ userId: user._id }).lean()
  assert.equal(person, null)
})

test('admin can set role to management and roster as management', async () => {
  const user = await User.create({
    name: 'User Three',
    displayName: 'User Three',
    phone: '9000000003',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
  })

  const res = await request(app)
    .patch(`/api/v1/admin/members/${user._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'management' })
    .expect(200)

  assert.equal(res.body?.member?.role, 'management')

  const person = await Person.findOne({ userId: user._id }).lean()
  assert.ok(person)
  assert.equal(person.role, 'management')
})

test('admin cannot set member role to admin', async () => {
  const user = await User.create({
    name: 'User Four',
    displayName: 'User Four',
    phone: '9000000004',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
  })

  await request(app)
    .patch(`/api/v1/admin/members/${user._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'admin' })
    .expect(400)
})

test('admin cannot create member with role=admin', async () => {
  await request(app)
    .post('/api/v1/admin/members')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'User Five', phone: '9000000005', password: 'password1', role: 'admin' })
    .expect(400)
})

test('search by referral code returns users who used it (referredBy)', async () => {
  const referrer = await User.create({
    name: 'Referrer',
    displayName: 'Referrer',
    phone: '9000000010',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
    referralCode: 'REF123',
  })

  await User.create({
    name: 'Referred User',
    displayName: 'Referred User',
    phone: '9000000011',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
    customFields: { referredBy: referrer.referralCode },
  })

  const res = await request(app)
    .get('/api/v1/admin/members?search=REF123')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)

  const names = (res.body?.data || []).map((u) => u.name)
  assert.ok(names.includes('Referred User'))
})

test('admin can toggle showPhoneOnPublic for a member', async () => {
  const user = await User.create({
    name: 'User Visibility',
    displayName: 'User Visibility',
    phone: '9000000013',
    passwordHash: 'x',
    role: 'sadharan',
    status: 'active',
    showPhoneOnPublic: false,
  })

  const res = await request(app)
    .patch(`/api/v1/admin/members/${user._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ showPhoneOnPublic: true })
    .expect(200)

  assert.equal(res.body?.member?.showPhoneOnPublic, true)

  const updated = await User.findById(user._id).lean()
  assert.equal(updated?.showPhoneOnPublic, true)
})
