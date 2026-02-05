
import { Router } from 'express'
import { ah } from '../utils/asyncHandler.js'
import sendOtp from '../utils/sendOtp.js'
import { User } from '../models/User.js'

const r = Router()

// phone => { code, expiresAt }
const store = new Map()

r.post('/start', ah(async (req, res) => {
  const { phone, type = "otp" } = req.body

 
  let templateId = 208576;
  if (type == "forgot") {
    templateId = 208418;
    const userExists = await User.exists({ phone })

    if (!userExists) {
      return res.status(404).json({
        error: 'This mobile number is not registered'
      })
    }
  }
  if (!phone) {
    return res.status(400).json({ error: 'Phone is required' })
  }

  const code = Math.floor(100000 + Math.random() * 900000)

  store.set(phone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  })
  console.log("otp=", code)

  const result = await sendOtp({
    phone,
    otp: code,
    templateId: templateId.toString()
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
