// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { CONFIG } from '../config/env.js'

export const auth = async (req,res,next)=>{
  try{
    const token = req.cookies?.token
    if(!token) return res.status(401).json({error:'Unauthorized'})
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET)
    const user = await User.findById(decoded.id)
    if(!user) return res.status(401).json({error:'Unauthorized'})
    if(decoded.sessionVersion !== user.sessionVersion) return res.status(401).json({error:'Session expired'})
    req.user = user
    next()
  }catch(e){ next(e) }
}

export const requireRole = (...roles)=> (req,res,next)=>{
  if(!req.user) return res.status(401).json({error:'Unauthorized'})
  if(!roles.includes(req.user.role)) return res.status(403).json({error:'Forbidden'})
  next()
}
