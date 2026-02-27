import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import request from 'supertest'

import { CONFIG } from '../config/env.js'

const normalizeOrigin = (origin) => {
  const raw = String(origin || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase()
  }
}

test('frontend origins include apex and www domains', () => {
  const origins = new Set(CONFIG.FRONTEND_URLS.map(normalizeOrigin))
  assert.equal(origins.has('https://jatparivar.org'), true)
  assert.equal(origins.has('https://www.jatparivar.org'), true)
})

test('cors preflight allows www domain', async () => {
  const allowedOrigins = new Set(CONFIG.FRONTEND_URLS.map(normalizeOrigin))
  const corsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.has(normalizeOrigin(origin))) return cb(null, true)
      return cb(new Error(`Not allowed by CORS: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  }
  const app = express()
  app.use(cors(corsOptions))
  app.options('/sample', cors(corsOptions))

  const res = await request(app)
    .options('/sample')
    .set('Origin', 'https://www.jatparivar.org')
    .set('Access-Control-Request-Method', 'GET')
    .expect(204)

  assert.equal(res.headers['access-control-allow-origin'], 'https://www.jatparivar.org')
})
