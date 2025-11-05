// backend/src/routes/uploads.routes.js
import { Router } from 'express'
import { upload } from '../utils/uploader.js'
import { ah } from '../utils/asyncHandler.js'

const r = Router()
r.post('/file', upload.single('file'), ah(async (req,res)=>{
  res.json({ url: `/uploads/${req.file.filename}` })
}))
export default r
