// backend/src/utils/adminTokens.js
import jwt from 'jsonwebtoken'
import { CONFIG } from '../config/env.js'

const ACCESS_EXPIRES_IN = CONFIG.ADMIN_JWT_EXPIRES || '1h'

export const signAdminToken = (admin) => {
  return jwt.sign({ id: admin._id, sessionVersion: admin.sessionVersion }, CONFIG.ADMIN_JWT_SECRET || CONFIG.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN
  })
}
