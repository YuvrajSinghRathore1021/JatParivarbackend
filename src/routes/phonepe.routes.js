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
import { generateUniqueReferralCode, isValidReferralCodeFormat, normalizeReferralCode } from '../utils/referral.js'

const r = Router()

const sign = (payloadBase64, path) => {
  const str = payloadBase64 + path + process.env.PHONEPE_SALT_KEY
  const sha256 = crypto.createHash('sha256').update(str).digest('hex')
  return `${sha256}###${process.env.PHONEPE_SALT_INDEX}`
}

const redirectUrl = CONFIG.PHONEPE.REDIRECT_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/callback`
const callbackUrl = CONFIG.PHONEPE.CALLBACK_URL || `${CONFIG.BASE_URL}${CONFIG.API_PREFIX}/payments/phonepe/webhook`

// r.post('/create', ah(async (req, res) => {
//   const { phone, refCode, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan } = req.body
//   const pre = await PreSignup.create({ phone, refCode, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan })
//   const amount = plan === 'founder' ? 10100000 : plan === 'member' ? 5000000 : 210000

//   const merchantTransactionId = nanoid(12)
//   const payload = {
//     merchantId: process.env.PHONEPE_MERCHANT_ID,
//     merchantTransactionId,
//     amount,
//     redirectUrl: `${redirectUrl}?pre=${pre._id}`,
//     callbackUrl,
//     paymentInstrument: { type: "PAY_PAGE" }
//   }
//   const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
//   const xverify = sign(payloadBase64)

//   const { data } = await axios.post(
//     `${process.env.PHONEPE_BASE_URL}`,
//     { request: payloadBase64 },
//     { headers: { 'Content-Type': 'application/json', 'X-VERIFY': xverify, 'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID } }
//   )

//   const orderId = data?.data?.merchantTransactionId || merchantTransactionId
//   await Payment.create({ preSignupId: pre._id, orderId, merchantTransactionId, amount, plan, status: 'created', raw: data })

//   res.json({ redirectUrl: data?.data?.instrumentResponse?.redirectInfo?.url })
// }))

// myyy 
r.post('/create', ah(async (req, res) => {
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
  const refExists = await User.exists({ referralCode: normalizedRef })
  if (!refExists) {
    return res.status(404).json({ error: 'Referral code not found' })
  }

  // 1. Create pre-signup entry
  const pre = await PreSignup.create({
    phone, refCode: normalizedRef, form, addr, gotra, janAadharUrl, profilePhotoUrl, plan
  });

  // 2. Amount in paisa
  // const amount = plan === 'founder' ? 10100000 : plan === 'member' ? 5000000 : 210000;
  const amount = 1;

  const merchantTransactionId = nanoid(12);

  // 3. PhonePe payment payload

  console.log("process.env.PHONEPE_MERCHANT_ID=", process.env.PHONEPE_MERCHANT_ID);
  console.log("process.env.PHONEPE_SALT_KEY=", process.env.PHONEPE_SALT_KEY);
  console.log("process.env.PHONEPE_BASE_URL=", process.env.PHONEPE_BASE_URL);
  console.log("process.env.PHONEPE_SALT_INDEX=", process.env.PHONEPE_SALT_INDEX);
  console.log("redirectUrl=", redirectUrl);
  console.log("callbackUrl=", callbackUrl);
  // // out put 
  //   process.env.PHONEPE_MERCHANT_ID= M222KPO0TO5IK_2601271644
  // process.env.PHONEPE_SALT_KEY= ZGRmN2U4ZjYtZDNkZS00NTk5LWI4NzYtM2MwNzc2YmY4ZmQ0
  // process.env.PHONEPE_BASE_URL= https://api-preprod.phonepe.com/apis/pg-sandbox
  // process.env.PHONEPE_SALT_INDEX= 1

  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: "U" + phone,
    mobileNumber: phone,
    amount,
    redirectUrl: `${redirectUrl}?pre=${pre._id}`,
    redirectMode: "POST",
    callbackUrl,
    paymentInstrument: { type: "PAY_PAGE" }
  };

  // 4. Base64 encode
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");

  // 5. Correct X-VERIFY checksum
  const textToHash = payloadBase64 + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(textToHash).digest("hex");
  const xverify = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

  // 6. Make Payment Request
  const { data } = await axios.post(
    `${process.env.PHONEPE_BASE_URL}/pg/v1/pay`,
    { request: payloadBase64 },
    {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID
      }
    }
  );

  // 7. Save payment record
  const orderId = data?.data?.merchantTransactionId || merchantTransactionId;

  await Payment.create({
    preSignupId: pre._id,
    orderId,
    merchantTransactionId,
    amount,
    plan,
    status: "created",
    raw: data
  });

  // 8. Send redirect URL to client
  return res.json({
    redirectUrl: data?.data?.instrumentResponse?.redirectInfo?.url
  });

}));

// new 
// r.post("/create", ah(async (req, res) => {
//   // const { MUID, amount, number } = req.body;
//   const MUID = 2638812;
//   const amount = 7;
//   const number = 7976929440;

//   if (!MUID || !amount || !number) {
//     return res.status(400).json({ error: "Invalid request data" });
//   }

//   const merchantTransactionId = "M" + Date.now();

//   // Amount in paisa
//   const finalAmount = Number(amount) * 100;

//   // 1️⃣ PhonePe payload (MATCHES PHP)
//   const payload = {
//     merchantId: process.env.PHONEPE_MERCHANT_ID,
//     merchantTransactionId,
//     merchantUserId: MUID,
//     amount: finalAmount,
//     mobileNumber: number,
//     redirectUrl: `${process.env.PHONEPE_REDIRECT_URL}/${merchantTransactionId}`,
//     redirectMode: "POST",
//     paymentInstrument: {
//       type: "PAY_PAGE"
//     }
//   };

//   // 2️⃣ Base64 encode
//   const payloadBase64 = Buffer
//     .from(JSON.stringify(payload))
//     .toString("base64");

//   // 3️⃣ Checksum (VERY IMPORTANT)
//   const stringToHash =
//     payloadBase64 +
//     "/pg/v1/pay" +
//     process.env.PHONEPE_SALT_KEY;

//   const checksum =
//     crypto.createHash("sha256")
//       .update(stringToHash)
//       .digest("hex") +
//     "###" +
//     process.env.PHONEPE_SALT_INDEX;

//   // 4️⃣ Call PhonePe PROD API
//   const phonePeResponse = await axios.post(
//     `${process.env.PHONEPE_BASE_URL}/pg/v1/pay`,
//     { request: payloadBase64 },
//     {
//       headers: {
//         "Content-Type": "application/json",
//         "X-VERIFY": checksum
//       }
//     }
//   );

//   // 5️⃣ Return redirect URL
//   return res.json({
//     success: true,
//     transactionId: merchantTransactionId,
//     redirectUrl:
//       phonePeResponse.data?.data?.instrumentResponse?.redirectInfo?.url
//   });
// }));

// const MERCHANT_ID = "M23NICKDCRP5X";
// const SALT_KEY = "N2EwNmI0N2ItMGJmMi00Mjg4LTkzYTUtNDdjMWU4OWNlMWI0";
// const KEY_INDEX = 1;

// r.post("/create", ah(async (req, res) => {
//   try {
//     const { MUID=1123, amount=1, number=7976929440 } = req.body;

//     if (!MUID || !amount || !number) {
//       return res.status(400).json({ message: "Invalid request data" });
//     }

//     const merchantTransactionId = "M" + Date.now();

//     // Prepare payload (same as PHP)
//     const payload = {
//       merchantId: MERCHANT_ID,
//       merchantTransactionId,
//       merchantUserId: MUID,
//       amount: amount * 100,
//       redirectUrl: `https://indiadealsonlinemedia.com/${merchantTransactionId}`,
//       redirectMode: "POST",
//       mobileNumber: number,
//       paymentInstrument: {
//         type: "PAY_PAGE",
//       },
//     };

//     // Base64 encode
//     const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");

//     // Hashing logic (MUST MATCH PHP)
//     const stringToHash = payloadBase64 + "/pg/v1/pay" + SALT_KEY;
//     const sha256Hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
//     const checksum = sha256Hash + "###" + KEY_INDEX;

//     // Send request to PhonePe
//     const response = await axios.post(
//       // "https://api.phonepe.com/apis/hermes/pg/v1/pay",
//       "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
//       { request: payloadBase64 },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "X-VERIFY": checksum,
//         },
//       }
//     );

//     return res.json({
//       message: "Order processed",
//       response: response.data,
//     });

//   } catch (err) {
//     console.error("Error:", err);
//     return res.status(500).json({ message: "Internal server error", error: err.message });
//   }
// }));

r.post('/webhook', ah(async (req, res) => {
  const event = req.body || {}
  const orderId = event?.data?.merchantTransactionId
  const code = event?.code
  const status = code === 'PAYMENT_SUCCESS' ? 'success' : 'failed'

  const pay = await Payment.findOneAndUpdate({ merchantTransactionId: orderId }, { $set: { status, raw: event } }, { new: true })
  if (!pay) return res.json({ ok: true })

  if (status === 'success') {
    const pre = await PreSignup.findById(pay.preSignupId)
    if (pre && pre.status !== 'paid') {
      pre.status = 'paid'; await pre.save()
      const passwordHash = await bcrypt.hash(pre.form.password, 10)
      // Basic referral check
      const role = pre.plan === 'founder' ? 'founder' : pre.plan === 'member' ? 'member' : 'sadharan'
      const referralCode = await generateUniqueReferralCode(User)
      const normalizedRef = normalizeReferralCode(pre.refCode)
      const user = await User.create({
        name: pre.form.name,
        email: pre.form.email,
        phone: pre.phone,
        passwordHash,
        role,
        referralCode,
        avatarUrl: pre.profilePhotoUrl,
        publicNote: '',
        ...(normalizedRef ? { customFields: { referredBy: normalizedRef } } : {})
      })
      await Membership.create({ userId: user._id, plan: pre.plan, status: 'active', startedAt: new Date() })
    }
  }
  res.json({ ok: true })
}))

const callbackHandler = ah(async (req, res) => {
  const preId = req.query.pre
  const pre = await PreSignup.findById(preId)
  const pay = await Payment.findOne({ preSignupId: preId }).sort({ createdAt: -1 })
  const firstFront = CONFIG.FRONTEND_URLS[0] || 'http://localhost:5173'

  if (pay?.status === 'success') {
    const user = await User.findOne({ phone: pre.phone })
    if (user) {
      const token = signFor(user)
      res.cookie('token', token, { httpOnly: true, sameSite: CONFIG.COOKIE_SAMESITE, secure: CONFIG.COOKIE_SECURE, path: '/' })
      return res.redirect(`${firstFront}/hi/dashboard`)
    }
  }
  return res.redirect(`${firstFront}/hi/register?status=${pay?.status || 'pending'}`)
})

r.get('/callback', callbackHandler)
r.post('/callback', callbackHandler)

export default r
