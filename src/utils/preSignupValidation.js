const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0

const pickFirstString = (values) =>
  values.find((v) => typeof v === 'string' && v.trim().length > 0)?.trim() || null

const validateAddressBlock = (addr) => {
  if (!addr || typeof addr !== 'object') return false
  return (
    isNonEmptyString(addr.state) &&
    isNonEmptyString(addr.district) &&
    isNonEmptyString(addr.city) &&
    isNonEmptyString(addr.village)
  )
}

export const extractUploadUrls = (body = {}) => {
  const janAadhaarUrl = pickFirstString([
    body?.janAadhaarUrl,
    body?.janAadharUrl,
    body?.form?.janAadhaarUrl,
    body?.form?.janAadharUrl,
    body?.janAadhaarFileUrl,
    body?.janAadharFileUrl,
  ])

  const profilePhotoUrl = pickFirstString([
    body?.profilePhotoUrl,
    body?.profilePhotoURL,
    body?.form?.profilePhotoUrl,
  ])

  return { janAadhaarUrl, profilePhotoUrl }
}

export const validatePreSignupPayload = (body = {}) => {
  const form = body?.form && typeof body.form === 'object' ? body.form : {}
  const gotra = body?.gotra && typeof body.gotra === 'object' ? body.gotra : {}

  const { janAadhaarUrl, profilePhotoUrl } = extractUploadUrls(body)

  if (!isNonEmptyString(form.name)) return { ok: false, error: 'Name is required' }
  if (!isNonEmptyString(form.email)) return { ok: false, error: 'Email is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email).trim())) return { ok: false, error: 'Invalid email' }
  if (!isNonEmptyString(form.password) || String(form.password).length < 6) return { ok: false, error: 'Password is required' }

  if (!isNonEmptyString(form.dob)) return { ok: false, error: 'Date of birth is required' }
  const dob = new Date(form.dob)
  if (Number.isNaN(dob.getTime())) return { ok: false, error: 'Invalid date of birth' }

  if (!isNonEmptyString(form.gender)) return { ok: false, error: 'Gender is required' }
  if (!isNonEmptyString(form.maritalStatus)) return { ok: false, error: 'Marital status is required' }
  if (!isNonEmptyString(form.education)) return { ok: false, error: 'Education is required' }
  if (!isNonEmptyString(form.occupation)) return { ok: false, error: 'Occupation is required' }
  if (!isNonEmptyString(form.department)) return { ok: false, error: 'Department is required' }
  if (!isNonEmptyString(form.designation)) return { ok: false, error: 'Designation is required' }

  if (!validateAddressBlock(form.occupationAddress)) return { ok: false, error: 'Occupation address is required' }
  if (!validateAddressBlock(form.currentAddress)) return { ok: false, error: 'Current address is required' }
  if (!validateAddressBlock(form.parentalAddress)) return { ok: false, error: 'Parental address is required' }

  if (!isNonEmptyString(gotra.self)) return { ok: false, error: 'Self gotra is required' }

  if (!janAadhaarUrl) return { ok: false, error: 'Jan Aadhaar is required' }
  if (!profilePhotoUrl) return { ok: false, error: 'Profile photo is required' }

  return { ok: true, janAadhaarUrl, profilePhotoUrl, dob }
}

