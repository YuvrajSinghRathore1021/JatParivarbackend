// backend/src/middleware/rateLimiters.js
import rateLimit from 'express-rate-limit'

export const buildPublicReadLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== 'GET',
  })

export const buildSensitiveLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })

