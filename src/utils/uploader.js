// backend/src/utils/uploader.js
import multer from 'multer'
import { ensureUploadDir, UPLOAD_DIR } from './uploadDir.js'

ensureUploadDir()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`)
})

const ALLOWED_DOC_MIME = new Set(['application/pdf'])

const isAllowedImage = (mimetype = '') => {
  if (typeof mimetype !== 'string') return false
  if (!mimetype.startsWith('image/')) return false
  // SVG can embed scripts; keep uploads limited to raster images.
  if (mimetype === 'image/svg+xml') return false
  return true
}

export const upload = multer({
  storage,
  // limits: { fileSize: 10 * 1024 * 1024 },
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImage(file.mimetype) && !ALLOWED_DOC_MIME.has(file.mimetype)) {
      return cb(new Error('Invalid file type'))
    }
    cb(null, true)
  }
})
