// backend/src/routes/admin/pages.routes.js
import { Router } from 'express'
import { Page } from '../../models/Page.js'
import { PageVersion } from '../../models/PageVersion.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serializePage = (page) => ({
  id: page._id,
  slug: page.slug,
  titleEn: page.titleEn,
  titleHi: page.titleHi,
  contentEn: page.contentEn,
  contentHi: page.contentHi,
  status: page.status,
  scheduledAt: page.scheduledAt,
  publishedAt: page.publishedAt,
  updatedAt: page.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const pages = await Page.find({}).sort('slug')
  res.json({ data: pages.map(serializePage) })
}))

router.get('/:slug', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug })
  if (!page) return res.status(404).json({ error: 'Page not found' })
  const versions = await PageVersion.find({ pageId: page._id }).sort('-createdAt').limit(20)
  res.json({ page: serializePage(page), versions: versions.map(v => ({
    id: v._id,
    version: v.version,
    titleEn: v.titleEn,
    titleHi: v.titleHi,
    contentEn: v.contentEn,
    contentHi: v.contentHi,
    summary: v.summary,
    published: v.published,
    publishedAt: v.publishedAt,
    createdAt: v.createdAt
  })) })
}))

router.put('/:slug', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { slug } = req.params
  const payload = req.body || {}
  let page = await Page.findOne({ slug })
  if (!page) {
    page = await Page.create({ slug, ...payload, updatedBy: req.admin._id })
  } else {
    Object.assign(page, payload, { updatedBy: req.admin._id })
    await page.save()
  }
  const latestVersion = await PageVersion.findOne({ pageId: page._id }).sort('-version')
  const nextVersion = (latestVersion?.version || 0) + 1
  const version = await PageVersion.create({
    pageId: page._id,
    version: nextVersion,
    titleEn: page.titleEn,
    titleHi: page.titleHi,
    contentEn: page.contentEn,
    contentHi: page.contentHi,
    summary: payload.changeSummary,
    createdBy: req.admin._id,
    published: false
  })
  await logAudit({
    admin: req.admin,
    entityType: 'page',
    entityId: page._id,
    action: 'update',
    summary: `Updated page ${slug}`,
    after: serializePage(page)
  })
  res.json({ page: serializePage(page), version: { id: version._id, version: version.version } })
}))

router.post('/:slug/publish', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { slug } = req.params
  const { versionId } = req.body
  const page = await Page.findOne({ slug })
  if (!page) return res.status(404).json({ error: 'Page not found' })
  let version
  if (versionId) {
    version = await PageVersion.findById(versionId)
    if (!version || version.pageId.toString() !== page._id.toString()) {
      return res.status(400).json({ error: 'Invalid version' })
    }
    page.titleEn = version.titleEn
    page.titleHi = version.titleHi
    page.contentEn = version.contentEn
    page.contentHi = version.contentHi
  } else {
    version = await PageVersion.findOne({ pageId: page._id }).sort('-createdAt')
  }
  page.status = 'published'
  page.publishedAt = new Date()
  await page.save()
  if (version) {
    version.published = true
    version.publishedAt = new Date()
    await version.save()
  }
  await logAudit({
    admin: req.admin,
    entityType: 'page',
    entityId: page._id,
    action: 'update',
    summary: `Published page ${slug}`,
    after: serializePage(page)
  })
  res.json({ page: serializePage(page) })
}))

router.post('/:slug/unpublish', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug })
  if (!page) return res.status(404).json({ error: 'Page not found' })
  page.status = 'draft'
  await page.save()
  await logAudit({
    admin: req.admin,
    entityType: 'page',
    entityId: page._id,
    action: 'update',
    summary: `Unpublished page ${page.slug}`,
    after: serializePage(page)
  })
  res.json({ page: serializePage(page) })
}))

export default router
