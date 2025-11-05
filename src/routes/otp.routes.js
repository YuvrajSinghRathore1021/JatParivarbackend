// backend/src/routes/otp.routes.js  (stub: OTP = 123456)
import { Router } from 'express'
import { ah } from '../utils/asyncHandler.js'

const store = new Map()

const r = Router()
r.post('/start', ah(async (req,res)=>{
  const { phone } = req.body
  const code = '123456' // TODO: integrate Airtel DLT
  store.set(phone, code)
  res.json({ ok:true, devCode: code })
}))
r.post('/verify', ah(async (req,res)=>{
  const { phone, code } = req.body
  if(store.get(phone) !== code) return res.status(400).json({error:'Invalid OTP'})
  res.json({ ok:true })
}))

export default r
