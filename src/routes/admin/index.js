// backend/src/routes/admin/index.js
import { Router } from 'express'
import { adminAuth } from '../../middleware/adminAuth.js'
import authRoutes from './auth.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import memberRoutes from './members.routes.js'
import founderRoutes from './founders.routes.js'
import paymentRoutes from './payments.routes.js'
import planRoutes from './plans.routes.js'
import achievementRoutes from './achievements.routes.js'
import adRoutes from './ads.routes.js'
import pageRoutes from './pages.routes.js'
import newsRoutes from './news.routes.js'
import historyRoutes from './history.routes.js'
import institutionRoutes from './institutions.routes.js'
import settingRoutes from './settings.routes.js'
import auditRoutes from './audit.routes.js'
import jobRoutes from './jobs.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/dashboard', adminAuth, dashboardRoutes)
router.use('/members', adminAuth, memberRoutes)
router.use('/founders', adminAuth, founderRoutes)
router.use('/payments', adminAuth, paymentRoutes)
router.use('/plans', adminAuth, planRoutes)
router.use('/achievements', adminAuth, achievementRoutes)
router.use('/ads', adminAuth, adRoutes)
router.use('/pages', adminAuth, pageRoutes)
router.use('/news', adminAuth, newsRoutes)
router.use('/history', adminAuth, historyRoutes)
router.use('/jobs', adminAuth, jobRoutes)   
router.use('/institutions', adminAuth, institutionRoutes)
router.use('/settings', adminAuth, settingRoutes)
router.use('/audit-logs', adminAuth, auditRoutes)

export default router
