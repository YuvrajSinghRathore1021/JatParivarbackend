// backend/src/config/env.js
import dotenv from 'dotenv'

// Load default `.env` first, then allow `.env.local` to override for local/dev.
// This lets you keep production values in `.env` and local/sandbox values in `.env.local`
// without changing code or deployment config.
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const list = (v, fallback) =>
  (v || fallback).split(',').map(s => s.trim()).filter(Boolean)

const inferPhonePeEnv = () => {
  const explicit = process.env.PHONEPE_ENV
  if (explicit) return String(explicit).toUpperCase()

  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase()
  const baseUrl = String(process.env.PUBLIC_BASE_URL || '')

  // Default to SANDBOX for local/dev to avoid Prod security blocks on localhost.
  if (nodeEnv !== 'production') return 'SANDBOX'
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) return 'SANDBOX'
  return 'PROD'
}

const phonepeEnv = inferPhonePeEnv()

const pickPhonePeCred = (key) => {
  // Prefer env-specific vars, fallback to the legacy single set.
  if (phonepeEnv === 'PROD') {
    return process.env[`PHONEPE_PROD_${key}`] || process.env[`PHONEPE_LIVE_${key}`] || process.env[`PHONEPE_${key}`]
  }
  return process.env[`PHONEPE_SANDBOX_${key}`] || process.env[`PHONEPE_TEST_${key}`] || process.env[`PHONEPE_${key}`]
}

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8000', 10),
  BASE_URL: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8000}`,
  FRONTEND_URLS: list(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN, 'http://localhost:5173,http://localhost:4173,https://jatparivar.org'),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',

  COOKIE_SECURE: (process.env.COOKIE_SECURE || 'false') === 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'lax',

  MONGO_URI: process.env.MONGO_URI,

  PHONEPE: {
    // v2 (Standard Checkout)
    ENV: phonepeEnv, // SANDBOX | PROD
    CLIENT_ID: pickPhonePeCred('CLIENT_ID'),
    CLIENT_SECRET: pickPhonePeCred('CLIENT_SECRET'),
    CLIENT_VERSION: pickPhonePeCred('CLIENT_VERSION'),

    // v2 webhook auth (optional)
    WEBHOOK_AUTH_USERNAME: process.env.PHONEPE_WEBHOOK_AUTH_USERNAME,
    WEBHOOK_AUTH_PASSWORD: process.env.PHONEPE_WEBHOOK_AUTH_PASSWORD,

    // v1 (legacy checksum flow) - keep only if your account uses saltKey/saltIndex
    BASE_URL: process.env.PHONEPE_BASE_URL,
    MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID,
    SALT_KEY: process.env.PHONEPE_SALT_KEY,
    SALT_INDEX: process.env.PHONEPE_SALT_INDEX,

    // Default to this server URLs (works for localhost and prod)
    REDIRECT_URL: process.env.PHONEPE_REDIRECT_URL || `${process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8000}`}${process.env.API_PREFIX || '/api/v1'}/payments/phonepe/callback`,
    CALLBACK_URL: process.env.PHONEPE_CALLBACK_URL || `${process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8000}`}${process.env.API_PREFIX || '/api/v1'}/payments/phonepe/webhook`,
  },

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret',
  ADMIN_JWT_EXPIRES: process.env.ADMIN_JWT_EXPIRES || '2h'
}

export const cookieOpts = {
  httpOnly: true,
  secure: CONFIG.COOKIE_SECURE,
  sameSite: CONFIG.COOKIE_SAMESITE,
  path: '/',
}
