import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { connectDB } from './config/db.js'
import { CONFIG } from './config/env.js'

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

await connectDB()

const app = express()
app.set('trust proxy', 1)

// app.use(helmet())
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
)

// app.use(cors({
//   origin: (origin, cb) => {
//     if (!origin) return cb(null, true)
//     if (CONFIG.FRONTEND_URLS.includes(origin)) return cb(null, true)
//     return cb(new Error('Not allowed by CORS'))
//   },
//   credentials: true
// }))


app.use(cors({
  origin: (origin, callback) => {
    return callback(null, true); // allow all origins
  },
  credentials: true
}));

// ✅ MUST be above static route
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})



app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
// app.use('/uploads', express.static(path.resolve('src/uploads')))
app.use('/uploads', express.static(path.resolve('src/uploads')))

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })
app.use(limiter)

app.get(`${CONFIG.API_PREFIX}/health`, (_, res) => res.json({ ok: true }))

app.use(`${CONFIG.API_PREFIX}/auth`, authRoutes)
app.use(`${CONFIG.API_PREFIX}/otp`, otpRoutes)
app.use(`${CONFIG.API_PREFIX}/payments/phonepe`, phonepeRoutes)
app.use(`${CONFIG.API_PREFIX}/public`, publicRoutes)
app.use(`${CONFIG.API_PREFIX}/uploads`, uploadRoutes)
app.use(`${CONFIG.API_PREFIX}/matrimony`, matrimonyRoutes)
app.use(`${CONFIG.API_PREFIX}/jobs`, jobsRoutes)
app.use(`${CONFIG.API_PREFIX}/institutions`, institutionsRoutes)
app.use(`${CONFIG.API_PREFIX}/me`, meRoutes)
app.use(`${CONFIG.API_PREFIX}/geo`, geoRoutes)
app.use(`${CONFIG.API_PREFIX}/admin`, adminRoutes)

app.use((err, req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
})

app.listen(CONFIG.PORT, () => {
  console.log(`API on ${CONFIG.PORT} • prefix ${CONFIG.API_PREFIX}`)
})
