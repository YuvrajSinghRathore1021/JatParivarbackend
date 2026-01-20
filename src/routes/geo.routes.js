// backend/src/routes/geo.routes.js
import { Router } from 'express'
import { INDIA_LOCATIONS } from '../../shared/constants/indiaLocations.js'
import { Setting } from '../models/Setting.js'
import { ah } from '../utils/asyncHandler.js'
import { JAT_GOTRAS } from '../../shared/constants/gotras.js'

const r = Router()

const normalizeKey = (s) => {
  if (s === undefined || s === null) return ''
  return s.toString().trim()
}

const safeArray = (v) => (Array.isArray(v) ? v : [])

const asNamedItem = (raw = {}) => {
  const code = normalizeKey(raw.code)
  if (!code) return null
  const en = normalizeKey(raw.nameEn || raw?.name?.en)
  const hi = normalizeKey(raw.nameHi || raw?.name?.hi)
  return { code, name: { en, hi } }
}

const mergeListByCode = (base = [], custom = [], removed = new Set()) => {
  const out = []
  const idx = new Map()

  for (const item of base) {
    if (!item?.code) continue
    if (removed.has(item.code)) continue
    idx.set(item.code, out.length)
    out.push(item)
  }

  for (const item of custom) {
    if (!item?.code) continue
    if (removed.has(item.code)) continue
    const pos = idx.get(item.code)
    if (pos === undefined) {
      idx.set(item.code, out.length)
      out.push(item)
    } else {
      out[pos] = item
    }
  }

  return out
}

const normalizeRemove = (value = {}) => {
  const toSet = (list) => new Set(safeArray(list).map(normalizeKey).filter(Boolean))

  const states = toSet(value.states)

  const districts = {}
  if (value.districts && typeof value.districts === 'object') {
    for (const [stateCode, list] of Object.entries(value.districts)) {
      const stateKey = normalizeKey(stateCode)
      const set = toSet(list)
      if (stateKey && set.size) districts[stateKey] = set
    }
  }

  const cities = {}
  if (value.cities && typeof value.cities === 'object') {
    for (const [stateCode, distMap] of Object.entries(value.cities)) {
      const stateKey = normalizeKey(stateCode)
      if (!stateKey || !distMap || typeof distMap !== 'object') continue
      for (const [districtCode, list] of Object.entries(distMap)) {
        const distKey = normalizeKey(districtCode)
        const set = toSet(list)
        if (!distKey || !set.size) continue
        if (!cities[stateKey]) cities[stateKey] = {}
        cities[stateKey][distKey] = set
      }
    }
  }

  return { states, districts, cities }
}

const loadGeoCustom = async () => {
  const doc = await Setting.findOne({ key: 'geo.custom' }).lean()
  const value = doc?.value
  if (!value || typeof value !== 'object') {
    return { states: [], districts: {}, cities: {}, remove: { states: new Set(), districts: {}, cities: {} } }
  }

  const states = safeArray(value.states).map(asNamedItem).filter(Boolean)
  const districts = value.districts && typeof value.districts === 'object' ? value.districts : {}
  const cities = value.cities && typeof value.cities === 'object' ? value.cities : {}
  const remove = normalizeRemove(value.remove || {})

  const normalizedDistricts = {}
  for (const [stateCode, list] of Object.entries(districts)) {
    const key = normalizeKey(stateCode)
    if (!key) continue
    normalizedDistricts[key] = safeArray(list).map(asNamedItem).filter(Boolean)
  }

  const normalizedCities = {}
  for (const [stateCode, distMap] of Object.entries(cities)) {
    const stateKey = normalizeKey(stateCode)
    if (!stateKey || !distMap || typeof distMap !== 'object') continue
    normalizedCities[stateKey] = {}
    for (const [districtCode, list] of Object.entries(distMap)) {
      const distKey = normalizeKey(districtCode)
      if (!distKey) continue
      normalizedCities[stateKey][distKey] = safeArray(list).map(asNamedItem).filter(Boolean)
    }
  }

  return { states, districts: normalizedDistricts, cities: normalizedCities, remove }
}

const loadGotras = async () => {
  const doc = await Setting.findOne({ key: 'gotras' }).lean()
  const value = doc?.value
  const list = safeArray(value && value.length ? value : JAT_GOTRAS)
  return list
    .map((g) => {
      const val = normalizeKey(g?.value || g?.en || g?.hi)
      if (!val || val === '__custom') return null
      return {
        value: val,
        en: normalizeKey(g?.en || val),
        hi: normalizeKey(g?.hi || g?.en || val),
      }
    })
    .filter(Boolean)
}

r.use((req, _res, next) => {
  req.applyRemoval = (() => {
    const flag = req.query.filtered ?? req.query.applyRemove
    if (flag === undefined) return false
    return ['1', 'true', 'yes'].includes(String(flag).toLowerCase())
  })()
  next()
})

r.get('/states', ah(async (req, res) => {
  const geoCustom = await loadGeoCustom()

  const base = INDIA_LOCATIONS.map((st) => ({
    code: normalizeKey(st.code),
    name: { en: normalizeKey(st.nameEn), hi: normalizeKey(st.nameHi) },
  })).filter((x) => x.code)

  const removed = req.applyRemoval ? (geoCustom.remove?.states || new Set()) : new Set()
  const states = mergeListByCode(base, geoCustom.states, removed)
  res.json({ states })
}))

r.get('/districts', ah(async (req, res) => {
  const stateCode = normalizeKey(req.query.state)
  if (!stateCode) return res.status(400).json({ error: 'state is required' })

  const geoCustom = await loadGeoCustom()

  const st = INDIA_LOCATIONS.find((s) => normalizeKey(s.code) === stateCode)
  const base = safeArray(st?.districts).map((d) => ({
    code: normalizeKey(d.code),
    name: { en: normalizeKey(d.nameEn), hi: normalizeKey(d.nameHi) },
  })).filter((x) => x.code)

  const custom = safeArray(geoCustom?.districts?.[stateCode])
  const removed = req.applyRemoval ? (geoCustom.remove?.districts?.[stateCode] || new Set()) : new Set()
  const districts = mergeListByCode(base, custom, removed)

  res.json({ districts })
}))

r.get('/cities', ah(async (req, res) => {
  const stateCode = normalizeKey(req.query.state)
  const districtCode = normalizeKey(req.query.district)
  if (!stateCode || !districtCode) return res.status(400).json({ error: 'state and district are required' })

  const geoCustom = await loadGeoCustom()

  const st = INDIA_LOCATIONS.find((s) => normalizeKey(s.code) === stateCode)
  const dist = safeArray(st?.districts).find((d) => normalizeKey(d.code) === districtCode)

  const base = safeArray(dist?.cities).map((c) => ({
    code: normalizeKey(c.code),
    name: { en: normalizeKey(c.nameEn), hi: normalizeKey(c.nameHi) },
  })).filter((x) => x.code)

  const custom = safeArray(geoCustom?.cities?.[stateCode]?.[districtCode])
  const removed = req.applyRemoval ? (geoCustom.remove?.cities?.[stateCode]?.[districtCode] || new Set()) : new Set()
  const cities = mergeListByCode(base, custom, removed)

  res.json({ cities })
}))

r.get('/gotras', ah(async (_req, res) => {
  const gotras = await loadGotras()
  res.json({ gotras })
}))

export default r
