// backend/src/routes/admin/ads.routes.js
import { Router } from 'express'
import { GauravPerson } from '../../models/GauravPerson.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'


router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {


}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {

}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {

}))

export default router