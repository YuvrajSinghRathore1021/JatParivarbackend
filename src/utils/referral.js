// Utilities for referral codes: generation, normalization, and validation.
import { customAlphabet } from 'nanoid'

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeReferral = customAlphabet(REFERRAL_ALPHABET, 6)

export const normalizeReferralCode = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toUpperCase()
  return normalized.length ? normalized : null
}

// Allow existing long/seeded codes while enforcing sane patterns for new ones.
export const isValidReferralCodeFormat = (code) => {
  if (!code) return false
  return /^[A-Z0-9-]{4,32}$/.test(code)
}

export const generateUniqueReferralCode = async (UserModel, { maxAttempts = 25 } = {}) => {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = makeReferral()
    const taken = await UserModel.exists({ referralCode: code })
    if (!taken) return code
  }
  throw new Error('Could not generate referral code')
}
