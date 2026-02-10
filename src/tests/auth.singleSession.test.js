import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import bcrypt from 'bcryptjs'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import authRoutes from '../routes/auth.routes.js'
import { auth } from '../middleware/auth.js'
import { User } from '../models/User.js'

const getTokenCookie = (headers) => {
  const all = headers['set-cookie'] || []
  return all.find((value) => String(value).startsWith('token='))?.split(';')?.[0] || ''
}

let app

test.before(async () => {
  await startMongo()
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1/auth', authRoutes)
  app.get('/api/v1/protected', auth, (_req, res) => res.json({ ok: true }))
})

test.after(async () => {
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()
  await User.create({
    name: 'Single Session User',
    displayName: 'Single Session User',
    phone: '9000000013',
    passwordHash: await bcrypt.hash('Password@1', 10),
    role: 'sadharan',
    status: 'active',
    sessionVersion: 1
  })
})

test('new login invalidates previous device session', async () => {
  const login1 = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: '9000000013', password: 'Password@1' })
    .expect(200)
  const token1 = getTokenCookie(login1.headers)
  assert.ok(token1)

  await request(app)
    .get('/api/v1/protected')
    .set('Cookie', token1)
    .expect(200)

  const login2 = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: '9000000013', password: 'Password@1' })
    .expect(200)
  const token2 = getTokenCookie(login2.headers)
  assert.ok(token2)
  assert.notEqual(token1, token2)

  await request(app)
    .get('/api/v1/protected')
    .set('Cookie', token2)
    .expect(200)

  const oldSessionRes = await request(app)
    .get('/api/v1/protected')
    .set('Cookie', token1)
    .expect(401)
  assert.equal(oldSessionRes.body?.error, 'Session expired')

  const staleMe = await request(app)
    .get('/api/v1/auth/me')
    .set('Cookie', token1)
    .expect(200)
  assert.equal(staleMe.body?.user, null)
})
