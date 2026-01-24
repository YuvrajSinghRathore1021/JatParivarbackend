// // backend/src/routes/otp.routes.js  (stub: OTP = 123456)
// import { Router } from 'express'
// import { ah } from '../utils/asyncHandler.js'
// const sendOtp = require('../utils/sendOtp')
// const store = new Map()

// const r = Router()
// r.post('/start', ah(async (req, res) => {
//   const { phone } = req.body
//   const code = '123456' // TODO: integrate Airtel DLT
//   store.set(phone, code)
//   res.json({ ok: true, devCode: code })
// }))
// r.post('/verify', ah(async (req, res) => {
//   const { phone, code } = req.body
//   if (store.get(phone) !== code) return res.status(400).json({ error: 'Invalid OTP' })
//   res.json({ ok: true })
// }))

// export default r


import { Router } from 'express'
import { ah } from '../utils/asyncHandler.js'
import sendOtp from '../utils/sendOtp.js'


const r = Router()

// phone => { code, expiresAt }
const store = new Map()

r.post('/start', ah(async (req, res) => {
  const { phone } = req.body
  if (!phone) {
    return res.status(400).json({ error: 'Phone is required' })
  }

  const code = Math.floor(100000 + Math.random() * 900000)

  store.set(phone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  })
  // console.log("otp=", code)

  const result = await sendOtp({
    phone,
    otp: code,
    templateId: '208010'
  })

  if (!result.success) {
    return res.status(500).json({
      error: 'OTP sending failed',
      details: result.error
    })
    // return res.status(500).json({ error: 'OTP sending failed' })
  }

  res.json({ ok: true }) // ❌ no OTP leak
}))

r.post('/verify', ah(async (req, res) => {
  const { phone, code } = req.body

  const record = store.get(phone)
  if (!record) {
    return res.status(400).json({ error: 'OTP not found' })
  }

  if (Date.now() > record.expiresAt) {
    store.delete(phone)
    return res.status(400).json({ error: 'OTP expired' })
  }

  if (String(record.code) !== String(code)) {
    return res.status(400).json({ error: 'Invalid OTP' })
  }

  store.delete(phone)
  res.json({ ok: true })
}))

export default r
