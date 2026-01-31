import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'

import { buildPublicReadLimiter } from '../middleware/rateLimiters.js'

test('public read limiter allows high volume footer requests', async () => {
  const app = express()
  app.use(buildPublicReadLimiter())
  app.get('/public/site/footer', (_req, res) => res.json({ ok: true }))

  // Previously the global limiter max=200 would 429 here.
  for (let i = 0; i < 250; i++) {
    const res = await request(app).get('/public/site/footer')
    assert.equal(res.status, 200)
  }
})

