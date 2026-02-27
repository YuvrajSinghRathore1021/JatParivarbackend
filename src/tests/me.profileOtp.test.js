import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import axios from 'axios'

import { startMongo, stopMongo, resetDb } from './_setup.js'
import { CONFIG } from '../config/env.js'
import meRoutes from '../routes/me.routes.js'
import { User } from '../models/User.js'

const signUserCookie = (user) => {
  const token = jwt.sign(
    { id: user._id.toString(), sessionVersion: user.sessionVersion },
    CONFIG.JWT_SECRET
  )
  return `token=${token}`
}

let app
let user
let authCookie
let lastOtpCode = ''
let originalAxiosPost

test.before(async () => {
  await startMongo()
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1/me', meRoutes)
  originalAxiosPost = axios.post
})

test.after(async () => {
  axios.post = originalAxiosPost
  await stopMongo()
})

test.beforeEach(async () => {
  await resetDb()
  lastOtpCode = ''
  axios.post = async (_url, payload) => {
    const match = String(payload?.variables_values || '').match(/(\d{6})/)
    lastOtpCode = match ? match[1] : ''
    return { data: { ok: true } }
  }

  user = await User.create({
    name: 'Profile User',
    displayName: 'Profile User',
    phone: '9000000012',
    passwordHash: await bcrypt.hash('Password@1', 10),
    role: 'sadharan',
    status: 'active',
  })
  authCookie = signUserCookie(user)
})

test('profile save without OTP returns 403', async () => {
  const res = await request(app)
    .put('/api/v1/me/profile')
    .set('Cookie', authCookie)
    .send({ name: 'Changed Name' })
    .expect(403)

  assert.equal(res.body?.error, 'OTP verification required before profile update')
})

test('OTP start + verify + profile save succeeds', async () => {
  await request(app)
    .post('/api/v1/me/profile/otp/start')
    .set('Cookie', authCookie)
    .send({})
    .expect(200)

  assert.equal(lastOtpCode.length, 6)

  await request(app)
    .post('/api/v1/me/profile/otp/verify')
    .set('Cookie', authCookie)
    .send({ code: lastOtpCode })
    .expect(200)

  const updateRes = await request(app)
    .put('/api/v1/me/profile')
    .set('Cookie', authCookie)
    .send({ name: 'Changed Name', showPhoneOnPublic: true })
    .expect(200)

  assert.equal(updateRes.body?.user?.name, 'Changed Name')
  assert.equal(updateRes.body?.user?.showPhoneOnPublic, true)

  const updated = await User.findById(user._id).lean()
  assert.equal(updated?.name, 'Changed Name')
  assert.equal(updated?.showPhoneOnPublic, true)
})

test('OTP is consumed after one successful profile save', async () => {
  await request(app)
    .post('/api/v1/me/profile/otp/start')
    .set('Cookie', authCookie)
    .send({})
    .expect(200)

  await request(app)
    .post('/api/v1/me/profile/otp/verify')
    .set('Cookie', authCookie)
    .send({ code: lastOtpCode })
    .expect(200)

  await request(app)
    .put('/api/v1/me/profile')
    .set('Cookie', authCookie)
    .send({ displayName: 'One Save' })
    .expect(200)

  await request(app)
    .put('/api/v1/me/profile')
    .set('Cookie', authCookie)
    .send({ displayName: 'Second Save' })
    .expect(403)
})

test('password update without OTP returns 403', async () => {
  const res = await request(app)
    .put('/api/v1/me/profile/password')
    .set('Cookie', authCookie)
    .send({ newPassword: 'Password@2' })
    .expect(403)

  assert.equal(res.body?.error, 'OTP verification required before profile update')
})

test('OTP start + verify + password update succeeds', async () => {
  await request(app)
    .post('/api/v1/me/profile/otp/start')
    .set('Cookie', authCookie)
    .send({})
    .expect(200)

  await request(app)
    .post('/api/v1/me/profile/otp/verify')
    .set('Cookie', authCookie)
    .send({ code: lastOtpCode })
    .expect(200)

  const updateRes = await request(app)
    .put('/api/v1/me/profile/password')
    .set('Cookie', authCookie)
    .send({ newPassword: 'Password@2' })
    .expect(200)

  assert.equal(updateRes.body?.ok, true)

  const updated = await User.findById(user._id).select('passwordHash').lean()
  const matched = await bcrypt.compare('Password@2', updated.passwordHash)
  assert.equal(matched, true)
})

test('avatar update without OTP succeeds', async () => {
  const res = await request(app)
    .put('/api/v1/me/profile/avatar')
    .set('Cookie', authCookie)
    .send({ avatarUrl: '/uploads/new-avatar.png' })
    .expect(200)

  assert.equal(res.body?.avatarUrl, '/uploads/new-avatar.png')
  const updated = await User.findById(user._id).select('avatarUrl').lean()
  assert.equal(updated?.avatarUrl, '/uploads/new-avatar.png')
})

test('OTP start + verify + profile save can update password without current password', async () => {
  await request(app)
    .post('/api/v1/me/profile/otp/start')
    .set('Cookie', authCookie)
    .send({})
    .expect(200)

  await request(app)
    .post('/api/v1/me/profile/otp/verify')
    .set('Cookie', authCookie)
    .send({ code: lastOtpCode })
    .expect(200)

  const updateRes = await request(app)
    .put('/api/v1/me/profile')
    .set('Cookie', authCookie)
    .send({ displayName: 'With New Password', newPassword: 'Password@3' })
    .expect(200)

  assert.equal(updateRes.body?.user?.displayName, 'With New Password')
  const updated = await User.findById(user._id).select('passwordHash displayName').lean()
  const matched = await bcrypt.compare('Password@3', updated.passwordHash)
  assert.equal(matched, true)
  assert.equal(updated?.displayName, 'With New Password')
})

test('OTP verification fails on invalid code', async () => {
  await request(app)
    .post('/api/v1/me/profile/otp/start')
    .set('Cookie', authCookie)
    .send({})
    .expect(200)

  const wrongCode = lastOtpCode === '000000' ? '111111' : '000000'
  const res = await request(app)
    .post('/api/v1/me/profile/otp/verify')
    .set('Cookie', authCookie)
    .send({ code: wrongCode })
    .expect(400)

  assert.equal(res.body?.error, 'Invalid OTP')
})

test('OTP verification fails on expired code', async () => {
  const realDateNow = Date.now
  let now = realDateNow()
  Date.now = () => now
  try {
    await request(app)
      .post('/api/v1/me/profile/otp/start')
      .set('Cookie', authCookie)
      .send({})
      .expect(200)

    now += (5 * 60 * 1000) + 1

    const res = await request(app)
      .post('/api/v1/me/profile/otp/verify')
      .set('Cookie', authCookie)
      .send({ code: lastOtpCode })
      .expect(400)

    assert.equal(res.body?.error, 'OTP expired')
  } finally {
    Date.now = realDateNow
  }
})
