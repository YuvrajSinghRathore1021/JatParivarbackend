import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import publicRoutes from '../routes/public.routes.js'
import { User } from '../models/User.js'
import { Person } from '../models/Person.js'

let app

test.before(async () => {
  await startMongo()
  app = express()
  app.use('/api/v1/public', publicRoutes)
})

test.after(async () => {
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()
})

test('public people masks phone when showPhoneOnPublic is false', async () => {
  const user = await User.create({
    name: 'Hidden Phone',
    displayName: 'Hidden Phone',
    phone: '9000000201',
    passwordHash: 'x',
    role: 'founder',
    status: 'active',
    showPhoneOnPublic: false,
  })

  const person = await Person.create({
    userId: user._id,
    role: 'founder',
    name: 'Hidden Phone',
    visible: true,
    order: 1,
  })

  const listRes = await request(app)
    .get('/api/v1/public/people?role=founder')
    .expect(200)

  assert.equal(Array.isArray(listRes.body), true)
  assert.equal(listRes.body.length, 1)
  assert.equal(listRes.body[0]?.user?.phone, null)
  assert.equal(listRes.body[0]?.user?.alternatePhone, null)

  const detailRes = await request(app)
    .get(`/api/v1/public/people/${person._id}`)
    .expect(200)

  assert.equal(detailRes.body?.user?.phone, null)
  assert.equal(detailRes.body?.user?.alternatePhone, null)
})

test('public people shows phone for legacy users where flag is missing', async () => {
  const user = await User.create({
    name: 'Legacy User',
    displayName: 'Legacy User',
    phone: '9000000202',
    passwordHash: 'x',
    role: 'founder',
    status: 'active',
  })
  await User.updateOne({ _id: user._id }, { $unset: { showPhoneOnPublic: 1 } })

  await Person.create({
    userId: user._id,
    role: 'founder',
    name: 'Legacy User',
    visible: true,
    order: 1,
  })

  const listRes = await request(app)
    .get('/api/v1/public/people?role=founder')
    .expect(200)

  assert.equal(listRes.body?.[0]?.user?.phone, '9000000202')
})
