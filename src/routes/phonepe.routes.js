// backend/src/routes/phonepe.routes.js
import { Router } from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { nanoid } from 'nanoid'
import { ah } from '../utils/asyncHandler.js'
import { PreSignup } from '../models/PreSignup.js'
import { Payment } from '../models/Payment.js'
import { User } from '../models/User.js'
import bcrypt from 'bcryptjs'
import { Membership } from '../models/Membership.js'
import { signFor } from '../utils/jwt.js'
import { CONFIG } from '../config/env.js'

const r = Router()

const sign = (payloadBase64, path) => {
  const str = payloadBase64 + path + process.env.PHONEPE_SALT_KEY
  const sha256 = crypto.createHash('sha256').update(str).digest('hex')
  return `${sha256}###${process.env.PHONEPE_SALT_INDEX}`
}

const redirectUrl = CONFIG.PHONEPE.REDIRECT_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/callback`
const callbackUrl = CONFIG.PHONEPE.CALLBACK_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/webhook`

r.post('/create', ah(async (req,res)=>{
  const { phone, refCode, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan } = req.body
  const pre = await PreSignup.create({ phone, refCode, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan })
  const amount = plan==='founder' ? 10100000 : plan==='member' ? 5000000 : 210000

  const merchantTransactionId = nanoid(12)
  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    amount,
    redirectUrl: `${redirectUrl}?pre=${pre._id}`,
    callbackUrl,
    paymentInstrument: { type: "PAY_PAGE" }
  }
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const xverify = sign(payloadBase64, '/pg/v1/pay')

  const { data } = await axios.post(
    `${process.env.PHONEPE_BASE_URL}/pg/v1/pay`,
    { request: payloadBase64 },
    { headers: { 'Content-Type':'application/json', 'X-VERIFY': xverify, 'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID } }
  )

  const orderId = data?.data?.merchantTransactionId || merchantTransactionId
  await Payment.create({ preSignupId: pre._id, orderId, merchantTransactionId, amount, plan, status:'created', raw: data })

  res.json({ redirectUrl: data?.data?.instrumentResponse?.redirectInfo?.url })
}))

r.post('/webhook', ah(async (req,res)=>{
  const event = req.body || {}
  const orderId = event?.data?.merchantTransactionId
  const code = event?.code
  const status = code==='PAYMENT_SUCCESS'?'success':'failed'

  const pay = await Payment.findOneAndUpdate({ merchantTransactionId: orderId }, { $set: { status, raw: event } }, { new:true })
  if(!pay) return res.json({ ok:true })

  if(status==='success'){
    const pre = await PreSignup.findById(pay.preSignupId)
    if(pre && pre.status!=='paid'){
      pre.status='paid'; await pre.save()
      const passwordHash = await bcrypt.hash(pre.form.password, 10)
      // Basic referral check
      const role = pre.plan==='founder'?'founder': pre.plan==='member'?'member':'sadharan'
      const referralCode = (Math.floor(100000+Math.random()*900000)).toString()
      const user = await User.create({
        name: pre.form.name, email: pre.form.email, phone: pre.phone, passwordHash, role, referralCode,
        avatarUrl: pre.profilePhotoUrl, publicNote: ''
      })
      await Membership.create({ userId: user._id, plan: pre.plan, status:'active', startedAt: new Date() })
    }
  }
  res.json({ ok:true })
}))

r.get('/callback', ah(async (req,res)=>{
  const { pre: preId } = req.query
  const pre = await PreSignup.findById(preId)
  const pay = await Payment.findOne({ preSignupId: preId }).sort({createdAt:-1})
  const firstFront = CONFIG.FRONTEND_URLS[0] || 'http://localhost:5173'
  
  if(pay?.status==='success'){
    const user = await User.findOne({ phone: pre.phone })
    if(user){
      const token = signFor(user)
      res.cookie('token', token, { httpOnly:true, sameSite: CONFIG.COOKIE_SAMESITE, secure: CONFIG.COOKIE_SECURE, path:'/' })
      return res.redirect(`${firstFront}/hi/dashboard`)
    }
  }
  return res.redirect(`${firstFront}/hi/register?status=${pay?.status||'pending'}`)
}))

export default r
