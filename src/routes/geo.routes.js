// backend/src/routes/geo.routes.js
import { Router } from 'express'
import { INDIA_LOCATIONS } from '../../shared/constants/indiaLocations.js'
import { ah } from '../utils/asyncHandler.js'

const r = Router()

const normalizeState = (s) => {
  if (!s) return null
  return s.trim()
}

r.get('/states', ah(async (_req, res) => {
  const states = INDIA_LOCATIONS.map((st) => ({
    code: st.code,
    name: { en: st.nameEn, hi: st.nameHi },
  }))
  res.json({ states })
}))

r.get('/districts', ah(async (req, res) => {
  const stateCode = normalizeState(req.query.state)
  if (!stateCode) return res.status(400).json({ error: 'state is required' })
  const st = INDIA_LOCATIONS.find((s) => s.code === stateCode)
  if (!st) return res.json({ districts: [] })
  const districts = (st.districts || []).map((d) => ({
    code: d.code,
    name: { en: d.nameEn, hi: d.nameHi },
  }))
  res.json({ districts })
}))

r.get('/cities', ah(async (req, res) => {
  const stateCode = normalizeState(req.query.state)
  const districtCode = normalizeState(req.query.district)
  if (!stateCode || !districtCode) return res.status(400).json({ error: 'state and district are required' })

  const st = INDIA_LOCATIONS.find((s) => s.code === stateCode)
  if (!st) return res.json({ cities: [] })

  const dist = (st.districts || []).find((d) => d.code === districtCode)
  if (!dist) return res.json({ cities: [] })

  const cities = (dist.cities || []).map((c) => ({
    code: c.code,
    name: { en: c.nameEn, hi: c.nameHi },
  }))
  res.json({ cities })
}))

export default r
