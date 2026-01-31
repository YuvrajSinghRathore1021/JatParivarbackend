import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import { CONFIG } from '../config/env.js'
import { adminAuth } from '../middleware/adminAuth.js'
import paymentsRoutes from '../routes/admin/payments.routes.js'

import { Admin } from '../models/Admin.js'
import { Payment } from '../models/Payment.js'
import { Plan } from '../models/Plan.js'
import { User } from '../models/User.js'

const signAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id.toString(), sessionVersion: admin.sessionVersion },
    CONFIG.ADMIN_JWT_SECRET || CONFIG.JWT_SECRET
  )

let app
let token
let founderPlan

test.before(async () => {
  await startMongo()
  app = express()
  app.use(express.json())
  app.use('/api/v1/admin/payments', adminAuth, paymentsRoutes)
})

test.after(async () => {
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()

  founderPlan = await Plan.create({ code: 'founder', titleEn: 'Founder', price: 101000 })

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

test('payments list returns payer name/phone and supports search by phone', async () => {
  const user = await User.create({
    name: 'Payment User',
    displayName: 'Payment User',
    phone: '9000000099',
    passwordHash: 'x',
    role: 'founder',
    status: 'active',
  })

  await Payment.create({
    userId: user._id,
    planId: founderPlan._id,
    planTitle: founderPlan.titleEn,
    orderId: 'ORD-1',
    merchantTransactionId: 'MTX-1',
    amount: 101000,
    status: 'success',
    provider: 'manual',
  })

  const res = await request(app)
    .get('/api/v1/admin/payments?search=9000000099')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)

  assert.equal(res.body?.data?.length, 1)
  const row = res.body.data[0]
  assert.equal(row.payer?.type, 'user')
  assert.equal(row.payer?.phone, '9000000099')
  assert.equal(row.payer?.name, 'Payment User')
})

test('payments list supports plan filter by code (plan=founder)', async () => {
  const user = await User.create({
    name: 'Plan Filter User',
    displayName: 'Plan Filter User',
    phone: '9000000088',
    passwordHash: 'x',
    role: 'founder',
    status: 'active',
  })

  await Payment.create({
    userId: user._id,
    planId: founderPlan._id,
    planTitle: founderPlan.titleEn,
    orderId: 'ORD-2',
    merchantTransactionId: 'MTX-2',
    amount: 101000,
    status: 'success',
    provider: 'manual',
  })

  const res = await request(app)
    .get('/api/v1/admin/payments?plan=founder')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)

  assert.equal(res.body?.data?.length, 1)
  assert.equal(res.body.data[0].orderId, 'ORD-2')
})

