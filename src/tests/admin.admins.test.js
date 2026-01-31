import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import { CONFIG } from '../config/env.js'
import { adminAuth } from '../middleware/adminAuth.js'
import adminsRoutes from '../routes/admin/admins.routes.js'

import { Admin } from '../models/Admin.js'

const signAdminToken = (admin) =>
  jwt.sign(
    { id: admin._id.toString(), sessionVersion: admin.sessionVersion },
    CONFIG.ADMIN_JWT_SECRET || CONFIG.JWT_SECRET
  )

let app
let token
let adminId

test.before(async () => {
  await startMongo()
  app = express()
  app.use(express.json())
  app.use('/api/v1/admin/admins', adminAuth, adminsRoutes)
})

test.after(async () => {
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()

  const admin = await Admin.create({
    phone: '9990000000',
    name: 'Test Admin',
    passwordHash: 'x',
    roles: ['SUPER_ADMIN'],
    status: 'active',
    sessionVersion: 1,
  })
  adminId = admin._id.toString()
  token = signAdminToken(admin)
})

test('super admin can create + list admins', async () => {
  const created = await request(app)
    .post('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${token}`)
    .send({ phone: '9990000001', name: 'Second Admin', password: 'password123', roles: ['CONTENT_ADMIN'] })
    .expect(201)

  assert.equal(created.body?.admin?.phone, '9990000001')
  assert.deepEqual(created.body?.admin?.roles, ['CONTENT_ADMIN'])

  const list = await request(app)
    .get('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)

  assert.ok(Array.isArray(list.body?.admins))
  assert.ok(list.body.admins.some((a) => a.phone === '9990000001'))
})

test('super admin cannot delete own admin', async () => {
  await request(app)
    .delete(`/api/v1/admin/admins/${adminId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(400)
})

test('super admin can delete another admin', async () => {
  const other = await Admin.create({
    phone: '9990000002',
    name: 'Other Admin',
    passwordHash: 'x',
    roles: ['CONTENT_ADMIN'],
    status: 'active',
    sessionVersion: 1,
  })

  await request(app)
    .delete(`/api/v1/admin/admins/${other._id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(204)

  const found = await Admin.findById(other._id).lean()
  assert.ok(found?.deletedAt)
  assert.equal(found.status, 'suspended')
})

