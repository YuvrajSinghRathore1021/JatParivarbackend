import { Router } from 'express'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { auth } from '../middleware/auth.js'
import NumberRequest from "../models/NumberRequest.js";


import { ah } from '../utils/asyncHandler.js'

const r = Router()


r.get('/foundpeople', ah(async (req, res) => {
    const {
        page = 1,
        pageSize = 20,
        state, district, city, gotra, occupation, search, status, role,
        from, to,
        sortBy = 'createdAt',
        sortDir = 'desc'
    } = req.query

    const parsedPage = Math.max(1, parseInt(page, 10) || 1)
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const filter = {}
    if (search) {
        const regex = new RegExp(search, 'i')
        filter.$or = [
            { name: regex },

            { alternatePhone: regex },
            { referralCode: regex },
            { 'gotra.self': regex },

        ]
    }
    if (status) filter.status = status
    if (role) filter.role = role
    if (state) filter['currentAddress.stateCode'] = state
    if (district) filter['currentAddress.districtCode'] = district
    if (city) filter['currentAddress.cityCode'] = city
    if (gotra) filter['gotra.self'] = gotra
    if (occupation) filter['occupation'] = occupation
    // if (from || to) {
    //   filter.createdAt = {}
    //   if (from) filter.createdAt.$gte = new Date(from)
    //   if (to) filter.createdAt.$lte = new Date(to)
    // }

    const allowedSortBy = new Set(['createdAt', 'name', 'role'])
    const sortField = allowedSortBy.has(sortBy) ? sortBy : 'createdAt'
    const sortOrder = sortDir === 'asc' ? 1 : -1
    const sort = { [sortField]: sortOrder }
    if (sortField !== 'createdAt') {
        sort.createdAt = -1
    }

    const skip = (parsedPage - 1) * parsedPageSize

    const [data, total] = await Promise.all([
        User.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parsedPageSize),
        User.countDocuments(filter)
    ])

    res.json({
        data: data.map(serializeUser),
        meta: {
            total,
            page: parsedPage,
            pageSize: parsedPageSize,
            sortBy: sortField,
            sortDir: sortOrder === 1 ? 'asc' : 'desc'
        }
    })
}))



const serializeUser = (user) => ({
    id: user._id,
    name: user.name,
    displayName: user.displayName,
    email: user.email,



    role: user.role,
    gender: user.gender,
    maritalStatus: user.maritalStatus,

    occupationAddress: user.occupationAddress,
    currentAddress: user.currentAddress,
    parentalAddress: user.parentalAddress,
    gotra: user.gotra,
    occupation: user.occupation,
    company: user.company,

    avatarUrl: user.avatarUrl,
    contactEmail: user.contactEmail,
    publicNote: user.publicNote,

    bussinessurl: user.bussinessurl,
    adimage: user.adimage,
    message: user.message,

    createdAt: user.createdAt,
    updatedAt: user.updatedAt
})


/* ===============================
   1️⃣ SEND NUMBER REQUEST
================================ */
r.post("/request/send", auth, ah(async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    // Check already exists
    let exist = await NumberRequest.findOne({ senderId, receiverId });

    if (exist) {
        return res.json({ success: true, request: exist });
    }

    const newReq = await NumberRequest.create({
        senderId,
        receiverId,
        status: "pending"
    });

    res.json({ success: true, request: newReq });
}));


/* ===============================
   2️⃣ CHECK STATUS FROM SENDER SIDE
================================ */
r.get("/request/status/:receiverId", auth, ah(async (req, res) => {
    const senderId = req.user._id;
    const receiverId = req.params.receiverId;

    // Find existing request
    const request = await NumberRequest.findOne({ senderId, receiverId });

    if (!request) return res.json(null);

    let out = request.toObject();

    // If approved → attach receiver phone
    if (request.status === "approved") {
        const receiver = await User.findById(receiverId)
            .select("phone alternatePhone");

        out.receiverPhone =
            receiver?.alternatePhone ||
            receiver?.phone ||
            null;
    }

    res.json(out);
}));

/* ===============================
   3️⃣ INCOMING REQUESTS (Receiver)
================================ */



// r.get("/request/incoming", auth, ah(async (req, res) => {
//     const receiverId = req.user._id;

//     const all = await NumberRequest.find({ receiverId })
//         .populate("senderId", "name avatarUrl occupation");

//     res.json(all);
// }));


r.get("/request/incoming", auth, ah(async (req, res) => {
    const receiverId = req.user._id;

    const all = await NumberRequest.find({
        receiverId,
        status: "pending"  // ⭐ only pending
    })
        .populate("senderId", "name avatarUrl occupation");

    res.json(all);
}));




/* ===============================
   4️⃣ APPROVE / REJECT REQUEST
================================ */
r.patch("/request/approve/:id", auth, ah(async (req, res) => {
    const { decision } = req.body;   // approved / rejected

    const reqDoc = await NumberRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: "Request not found" });

    // Only receiver can approve/reject
    if (String(reqDoc.receiverId) !== String(req.user._id)) {
        return res.status(403).json({ message: "Not allowed" });
    }

    reqDoc.status = decision;
    await reqDoc.save();

    res.json({ success: true, request: reqDoc });
}));



export default r
