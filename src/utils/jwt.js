// backend/src/utils/jwt.js
import jwt from 'jsonwebtoken'
import { CONFIG } from '../config/env.js'

export const signFor = (user) => {
  return jwt.sign(
    { id: user._id, sessionVersion: user.sessionVersion },
    CONFIG.JWT_SECRET,
    { expiresIn: CONFIG.JWT_EXPIRES }
  )
}
