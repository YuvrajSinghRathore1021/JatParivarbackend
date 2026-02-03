import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { connectDB } from './config/db.js'
import { CONFIG } from './config/env.js'
import { buildPublicReadLimiter, buildSensitiveLimiter } from './middleware/rateLimiters.js'
import { ensureUploadDir, UPLOAD_DIR } from './utils/uploadDir.js'

import authRoutes from './routes/auth.routes.js'
import otpRoutes from './routes/otp.routes.js'
import phonepeRoutes from './routes/phonepe.routes.js'
import publicRoutes from './routes/public.routes.js'
import uploadRoutes from './routes/uploads.routes.js'
import matrimonyRoutes from './routes/matrimony.routes.js'
import jobsRoutes from './routes/jobs.routes.js'
import institutionsRoutes from './routes/institutions.routes.js'
import meRoutes from './routes/me.routes.js'
import geoRoutes from './routes/geo.routes.js'
import adminRoutes from './routes/admin/index.js'
import foundRoutes from './routes/found.routes.js'

await connectDB()
ensureUploadDir()

const app = express()
app.set('trust proxy', 1)

// app.use(helmet())
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
)

const corsOptions = {
  origin: (origin, cb) => {
    // Allow non-browser requests (curl, server-to-server, etc.)
    if (!origin) return cb(null, true)
    if (CONFIG.FRONTEND_URLS.includes(origin)) return cb(null, true)
    return cb(new Error(`Not allowed by CORS: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Public file hosting: allow images to be embedded anywhere.
app.use('/uploads', cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }))



app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
// app.use('/uploads', express.static(path.resolve('src/uploads')))
app.use('/uploads', express.static(UPLOAD_DIR))

// Rate limiting:
// - Allow higher throughput for public read endpoints (footer/home pages are fetched for every visitor).
// - Keep stricter limits for auth/admin/payment flows.
const publicReadLimiter = buildPublicReadLimiter()
const sensitiveLimiter = buildSensitiveLimiter()

app.use(`${CONFIG.API_PREFIX}/public`, publicReadLimiter)
app.use(`${CONFIG.API_PREFIX}/auth`, sensitiveLimiter)
app.use(`${CONFIG.API_PREFIX}/otp`, sensitiveLimiter)
app.use(`${CONFIG.API_PREFIX}/payments/phonepe`, sensitiveLimiter)
app.use(`${CONFIG.API_PREFIX}/admin`, sensitiveLimiter)

app.get(`${CONFIG.API_PREFIX}/health`, (_, res) => res.json({ ok: true }))

app.use(`${CONFIG.API_PREFIX}/auth`, authRoutes)
app.use(`${CONFIG.API_PREFIX}/otp`, otpRoutes)
app.use(`${CONFIG.API_PREFIX}/payments/phonepe`, phonepeRoutes)
app.use(`${CONFIG.API_PREFIX}/public`, publicRoutes)
app.use(`${CONFIG.API_PREFIX}/found`, foundRoutes)
app.use(`${CONFIG.API_PREFIX}/uploads`, uploadRoutes)
app.use(`${CONFIG.API_PREFIX}/matrimony`, matrimonyRoutes)
app.use(`${CONFIG.API_PREFIX}/jobs`, jobsRoutes)
app.use(`${CONFIG.API_PREFIX}/institutions`, institutionsRoutes)
app.use(`${CONFIG.API_PREFIX}/me`, meRoutes)    
app.use(`${CONFIG.API_PREFIX}/geo`, geoRoutes)
app.use(`${CONFIG.API_PREFIX}/admin`, adminRoutes)

app.use((err, req, res, _next) => {
  console.error(err)
  const status =
    err.status ||
    (err.name === 'MulterError' ? 400 : undefined) ||
    (err.message === 'Invalid file type' ? 400 : undefined) ||
    500
  res.status(status).json({ error: err.message || 'Server error' })
})

app.listen(CONFIG.PORT, () => {
  console.log(`API on ${CONFIG.PORT} • prefix ${CONFIG.API_PREFIX}`)
})
