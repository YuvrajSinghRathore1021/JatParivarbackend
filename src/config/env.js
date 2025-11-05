// backend/src/config/env.js
import 'dotenv/config'

const list = (v, fallback) =>
  (v || fallback).split(',').map(s => s.trim()).filter(Boolean)

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
    BASE_URL: process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID || '',
    SALT_KEY: process.env.PHONEPE_SALT_KEY || '',
    SALT_INDEX: process.env.PHONEPE_SALT_INDEX || '1',
    REDIRECT_URL: process.env.PHONEPE_REDIRECT_URL,
    CALLBACK_URL: process.env.PHONEPE_CALLBACK_URL,
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
