// backend/src/routes/phonepe.routes.js
import { Router } from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { customAlphabet } from 'nanoid'
import { ah } from '../utils/asyncHandler.js'
import { PreSignup } from '../models/PreSignup.js'
import { Payment } from '../models/Payment.js'
import { User } from '../models/User.js'
import { Plan } from '../models/Plan.js'
import bcrypt from 'bcryptjs'
import { Membership } from '../models/Membership.js'
import { signFor } from '../utils/jwt.js'
import { CONFIG } from '../config/env.js'
import { generateUniqueReferralCode, isValidReferralCodeFormat, normalizeReferralCode, referralCodeRegex } from '../utils/referral.js'
import { validatePreSignupPayload } from '../utils/preSignupValidation.js'
import sendSms from '../utils/sendSms.js'
const r = Router()

let cachedAccessToken = null
let cachedAccessTokenExpiryMs = 0

const nowMs = () => Date.now()

const phonepeIsProd = () => ['PROD', 'PRODUCTION', 'LIVE'].includes((CONFIG.PHONEPE.ENV || '').toUpperCase())

const phonepeV2Urls = () => {
  if (phonepeIsProd()) {
    return {
      tokenUrl: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
      pgBaseUrl: 'https://api.phonepe.com/apis/pg',
      payUrl: 'https://api.phonepe.com/apis/pg/checkout/v2/pay',
    }
  }
  return {
    tokenUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    pgBaseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    payUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay',
  }
}

const hasPhonePeV2Config = () =>
  Boolean(CONFIG.PHONEPE.CLIENT_ID && CONFIG.PHONEPE.CLIENT_SECRET && CONFIG.PHONEPE.CLIENT_VERSION)

const makeOrderId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 14)

const getPhonePeAccessToken = async () => {
  if (cachedAccessToken && nowMs() < cachedAccessTokenExpiryMs - 60_000) return cachedAccessToken

  if (!CONFIG.PHONEPE.CLIENT_ID) throw new Error('Missing PHONEPE_CLIENT_ID')
  if (!CONFIG.PHONEPE.CLIENT_SECRET) throw new Error('Missing PHONEPE_CLIENT_SECRET')
  if (!CONFIG.PHONEPE.CLIENT_VERSION) throw new Error('Missing PHONEPE_CLIENT_VERSION')

  const { tokenUrl } = phonepeV2Urls()
  const body = new URLSearchParams({
    client_id: CONFIG.PHONEPE.CLIENT_ID,
    client_version: CONFIG.PHONEPE.CLIENT_VERSION,
    client_secret: CONFIG.PHONEPE.CLIENT_SECRET,
    grant_type: 'client_credentials',
  })

  const { data } = await axios.post(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  const accessToken = data?.access_token
  const expiresAtSec = data?.expires_at
  const expiresInSec = data?.expires_in

  if (!accessToken) throw new Error('PhonePe OAuth: missing access_token')

  cachedAccessToken = accessToken
  cachedAccessTokenExpiryMs = expiresAtSec
    ? Number(expiresAtSec) * 1000
    : nowMs() + (Number(expiresInSec || 300) * 1000)

  return cachedAccessToken
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getPhonePeV2OrderStatus = async (merchantOrderId) => {
  const token = await getPhonePeAccessToken()
  const { pgBaseUrl } = phonepeV2Urls()
  const url = `${pgBaseUrl}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false&errorContext=true`
  const { data } = await axios.get(url, {
    headers: { Authorization: `O-Bearer ${token}` },
  })
  return data
}

const mapV2StateToStatus = (state) => {
  if (state === 'COMPLETED') return 'success'
  if (state === 'FAILED') return 'failed'
  return 'pending'
}

const fulfillPreSignupIfNeeded = async (pre) => {
  if (!pre) return null

  if (pre.status !== 'paid') {
    pre.status = 'paid'
    await pre.save()
  }

  const preForm = pre.form && typeof pre.form === 'object' ? pre.form : {}
  const preGotra = pre.gotra && typeof pre.gotra === 'object' ? pre.gotra : {}
  const normalizedPlan = pre.plan === 'member' ? 'management' : pre.plan
  const planCode = ['founder', 'management', 'sadharan'].includes(normalizedPlan) ? normalizedPlan : 'sadharan'

  let user = await User.findOne({ phone: pre.phone })
  if (!user) {
    const passwordHash = await bcrypt.hash(preForm.password, 10)
    const role = planCode === 'founder' ? 'founder' : planCode === 'management' ? 'management' : 'sadharan'
    const referralCode = await generateUniqueReferralCode(User)
    const normalizedRef = normalizeReferralCode(pre.refCode)
    const dateOfBirth = preForm.dob ? new Date(preForm.dob) : undefined
    const planDoc = await Plan.findOne({ code: planCode }).select('_id titleEn titleHi price').lean()

    user = await User.create({
      name: preForm.name,
      displayName: preForm.name,
      email: preForm.email,
      phone: pre.phone,
      passwordHash,
      role,
      referralCode,
      avatarUrl: pre.profilePhotoUrl,
      publicNote: '',
      occupation: preForm.occupation,
      designation: preForm.designation,
      department: preForm.department,
      education: preForm.education,
      gender: preForm.gender,
      dateOfBirth: Number.isNaN(dateOfBirth?.getTime?.()) ? undefined : dateOfBirth,
      occupationAddress: preForm.occupationAddress,
      currentAddress: preForm.currentAddress,
      parentalAddress: preForm.parentalAddress,
      gotra: {
        self: preGotra.self,
        mother: preGotra.mother,
        dadi: preGotra.dadi,
        nani: preGotra.nani
      },
      contactEmail: preForm.email,
      profession: preForm.occupation,
      maritalStatus: preForm.maritalStatus,
      planId: planDoc?._id,
      planTitle: planDoc?.titleEn || planDoc?.titleHi,
      planAmount: planDoc?.price,
      status: 'active',
      janAadhaarUrl: pre.janAadharUrl,
      ...(normalizedRef ? { customFields: { referredBy: normalizedRef } } : {})
    })
  }

  const existing = await Membership.findOne({ userId: user._id, status: 'active' })
  if (!existing) {
    await Membership.create({ userId: user._id, plan: planCode, status: 'active', startedAt: new Date() })
  }

  await Payment.updateMany(
    { preSignupId: pre._id },
    { $set: { userId: user._id } }
  )

  // ✅ SEND SMS TO REFERRAL USER
  if (pre.refCode) {
    const refUser = await User.findOne({
      referralCode: referralCodeRegex(pre.refCode)
    }).select('phone name displayName')

    if (refUser?.phone) {
      try {
        await sendSms({
          to: refUser.phone,
          newUserName: user.displayName || user.name || 'A new member',
          templateId: 208469
        })
      } catch (err) {
        console.error('Referral SMS failed:', err.message)
      }
    }
  }
  // send thank you sms to user
  // try {
  //   await sendSms({
  //     to: user.phone,
  //     newUserName: user.displayName || user.name || 'A new member',
  //     templateId: 208470
  //   })
  // } catch (err) {
  //   console.error('Thank you SMS failed:', err.message)
  // }

  return user
}

const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex')

const validatePhonePeWebhookAuth = (req) => {
  const u = CONFIG.PHONEPE.WEBHOOK_AUTH_USERNAME
  const p = CONFIG.PHONEPE.WEBHOOK_AUTH_PASSWORD
  if (!u || !p) return true

  const got = req.get('authorization') || ''

  const safeEq = (a, b) => {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  }

  // Support both:
  // - Basic base64(username:password) (common in dashboards)
  // - SHA256 sha256(username:password) (legacy/custom)
  if (got.toLowerCase().startsWith('basic ')) {
    try {
      const decoded = Buffer.from(got.slice(6).trim(), 'base64').toString('utf8')
      return safeEq(decoded, `${u}:${p}`)
    } catch {
      return false
    }
  }

  const expected = `SHA256 ${sha256Hex(`${u}:${p}`)}`
  return safeEq(got, expected)
}

const signV1 = (payloadBase64, path) => {
  const str = payloadBase64 + path + CONFIG.PHONEPE.SALT_KEY
  const sha256 = crypto.createHash('sha256').update(str).digest('hex')
  return `${sha256}###${CONFIG.PHONEPE.SALT_INDEX}`
}

const redirectUrl = CONFIG.PHONEPE.REDIRECT_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/callback`
const callbackUrl = CONFIG.PHONEPE.CALLBACK_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/webhook`


// myyy 
r.post('/create', ah(async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const { phone, refCode, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan } = body

    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' })
    }

    const normalizedRef = normalizeReferralCode(refCode)
    if (!normalizedRef) {
      return res.status(400).json({ error: 'Referral code is required' })
    }
    if (!isValidReferralCodeFormat(normalizedRef)) {
      return res.status(400).json({ error: 'Invalid referral code format' })
    }
    const refExists = await User.exists({ referralCode: referralCodeRegex(normalizedRef) })
    if (!refExists) {
      return res.status(404).json({ error: 'Referral code not found' })
    }

    const validation = validatePreSignupPayload(body)
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error })
    }

    // 1. Create pre-signup entry
    const pre = await PreSignup.create({
      phone,
      refCode: normalizedRef,
      form,
      addr,
      gotra,
      janAadharUrl: validation.janAadhaarUrl,
      profilePhotoUrl: validation.profilePhotoUrl,
      plan
    });

    const normalizedPlan = plan === 'member' ? 'management' : plan
    const planCode = ['founder', 'management', 'sadharan'].includes(normalizedPlan) ? normalizedPlan : 'sadharan'
    const planDoc = await Plan.findOne({ code: planCode }).select('_id titleEn titleHi price active').lean()
    if (planDoc && planDoc.active === false) {
      return res.status(400).json({ error: 'Selected plan is not available' })
    }

    // Amount in paisa (PhonePe expects integer paisa)
    const fallbackPriceRupees = { founder: 101000, management: 50000, sadharan: 2100 }[planCode]
    const priceRupees = Number(planDoc?.price ?? fallbackPriceRupees)
    if (!Number.isFinite(priceRupees) || priceRupees <= 0) {
      return res.status(400).json({ error: 'Invalid plan price' })
    }
    const amount = Math.round(priceRupees * 100)

    const merchantTransactionId = `JP${makeOrderId()}`

    // Prefer PhonePe v2 Standard Checkout (OAuth) if configured.
    let data
    let orderId = merchantTransactionId

    if (hasPhonePeV2Config()) {
      const token = await getPhonePeAccessToken()
      const { payUrl } = phonepeV2Urls()

      const merchantOrderId = merchantTransactionId
      const payload = {
        merchantOrderId,
        amount,
        paymentFlow: {
          type: 'PG_CHECKOUT',
          merchantUrls: {
            redirectUrl: `${redirectUrl}?pre=${pre._id}&mo=${merchantOrderId}`,
          },
        },
      }

      const resp = await axios.post(payUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `O-Bearer ${token}`,
        },
      })

      data = resp.data
      orderId = data?.orderId || data?.data?.orderId || orderId
    } else {
      // PhonePe v1 checksum flow (legacy)
      if (!CONFIG.PHONEPE.BASE_URL) throw new Error('Missing PHONEPE_BASE_URL')
      if (!CONFIG.PHONEPE.MERCHANT_ID) throw new Error('Missing PHONEPE_MERCHANT_ID')
      if (!CONFIG.PHONEPE.SALT_KEY) throw new Error('Missing PHONEPE_SALT_KEY')
      if (!CONFIG.PHONEPE.SALT_INDEX) throw new Error('Missing PHONEPE_SALT_INDEX')

      const payload = {
        merchantId: CONFIG.PHONEPE.MERCHANT_ID,
        merchantTransactionId,
        merchantUserId: "U" + phone,
        mobileNumber: phone,
        amount,
        redirectUrl: `${redirectUrl}?pre=${pre._id}`,
        redirectMode: "POST",
        callbackUrl,
        paymentInstrument: { type: "PAY_PAGE" }
      };

      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
      const xverify = signV1(payloadBase64, '/pg/v1/pay')

      const resp = await axios.post(
        `${CONFIG.PHONEPE.BASE_URL}/pg/v1/pay`,
        { request: payloadBase64 },
        {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xverify,
            "X-MERCHANT-ID": CONFIG.PHONEPE.MERCHANT_ID
          }
        }
      )

      data = resp.data
      orderId = data?.data?.merchantTransactionId || orderId
    }

    const redirectOut =
      data?.redirectUrl ||
      data?.data?.redirectUrl ||
      data?.data?.instrumentResponse?.redirectInfo?.url ||
      data?.instrumentResponse?.redirectInfo?.url

    if (!redirectOut) {
      console.error('PhonePe create: missing redirectUrl', { data })
      return res.status(502).json({ error: 'PHONEPE_NO_REDIRECT', body: data })
    }

    await Payment.create({
      preSignupId: pre._id,
      planId: planDoc?._id,
      planTitle: planDoc?.titleEn || planDoc?.titleHi,
      orderId,
      merchantTransactionId,
      amount,
      status: "pending",
      raw: data
    });

    // 8. Send redirect URL to client
    return res.json({
      redirectUrl: redirectOut,
      preSignupId: pre._id,
      merchantTransactionId,
      orderId
    });
  } catch (e) {
    const status = e?.response?.status || 500
    const body = e?.response?.data
    console.error('PhonePe create error:', status, body || e?.message)
    return res.status(status).json({ error: 'PHONEPE_ERROR', status, body: body || { message: e?.message } })
  }

}));


r.post('/webhook', ah(async (req, res) => {
  if (!validatePhonePeWebhookAuth(req)) {
    return res.status(401).json({ ok: false })
  }

  const event = req.body || {}

  const merchantRef = event?.data?.merchantOrderId || event?.data?.merchantTransactionId
  const v2State = event?.data?.state
  const v2Event = event?.event
  const v1Code = event?.code

  const v1 = String(v1Code || '').toUpperCase()
  const status =
    v2State === 'COMPLETED' || v2Event === 'checkout.order.completed' || v1 === 'PAYMENT_SUCCESS'
      ? 'success'
      : (v2State === 'FAILED' || v2Event === 'checkout.order.failed' || ['PAYMENT_FAILED', 'PAYMENT_ERROR', 'PAYMENT_DECLINED'].includes(v1))
        ? 'failed'
        : 'pending'

  const pay = await Payment.findOneAndUpdate(
    { merchantTransactionId: merchantRef },
    { $set: { status, raw: event, ...(event?.data?.orderId ? { orderId: event.data.orderId } : {}) } },
    { new: true }
  )
  if (!pay) return res.json({ ok: true })

  if (status === 'success') {
    const pre = await PreSignup.findById(pay.preSignupId)
    await fulfillPreSignupIfNeeded(pre)
  }
  if (status === 'failed') {
    await PreSignup.findByIdAndUpdate(pay.preSignupId, { $set: { status: 'failed' } })
  }
  res.json({ ok: true })
}))

const callbackHandler = ah(async (req, res) => {
  const preId = req.query.pre
  const pre = await PreSignup.findById(preId)
  const merchantOrderId = req.query.mo
  let pay = merchantOrderId
    ? await Payment.findOne({ merchantTransactionId: merchantOrderId })
    : await Payment.findOne({ preSignupId: preId }).sort({ createdAt: -1 })
  const firstFront = CONFIG.FRONTEND_URLS[0] || 'http://localhost:5173'

  if (!pre || !pay) {
    return res.redirect(`${firstFront}/hi/register?status=pending`)
  }

  // If webhook didn't update yet (common in local dev), verify status via PhonePe on callback.
  if (pay.status !== 'success' && merchantOrderId && hasPhonePeV2Config()) {
    try {
      let statusData = await getPhonePeV2OrderStatus(merchantOrderId)
      for (let i = 0; i < 2 && mapV2StateToStatus(statusData?.state) === 'pending'; i += 1) {
        await sleep(1500)
        statusData = await getPhonePeV2OrderStatus(merchantOrderId)
      }

      const newStatus = mapV2StateToStatus(statusData?.state)
      if (newStatus !== pay.status) {
        pay = await Payment.findOneAndUpdate(
          { _id: pay._id },
          { $set: { status: newStatus, raw: statusData } },
          { new: true }
        )
      }
    } catch (e) {
      // If status API fails, fall back to existing pay status.
      console.error('PhonePe status check failed:', e?.response?.data || e?.message)
    }
  }

  if (pay?.status === 'success') {
    const user = await fulfillPreSignupIfNeeded(pre)
    if (user) {
      const token = signFor(user)
      res.cookie('token', token, { httpOnly: true, sameSite: CONFIG.COOKIE_SAMESITE, secure: CONFIG.COOKIE_SECURE, path: '/' })
      return res.redirect(`${firstFront}/hi/dashboard`)
    }
  }

  if (pay?.status === 'failed') {
    await PreSignup.findByIdAndUpdate(preId, { $set: { status: 'failed' } })
  }

  const qp = new URLSearchParams()
  qp.set('status', pay?.status || 'pending')
  if (preId) qp.set('pre', String(preId))
  if (merchantOrderId) qp.set('mo', String(merchantOrderId))
  return res.redirect(`${firstFront}/hi/register?${qp.toString()}`)
})

r.get('/callback', callbackHandler)
r.post('/callback', callbackHandler)

export default r
