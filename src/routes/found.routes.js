import { Router } from 'express'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { auth } from '../middleware/auth.js'
import NumberRequest from "../models/NumberRequest.js";


import { ah } from '../utils/asyncHandler.js'

const r = Router()


const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const makeRegex = (value) => new RegExp(escapeRegex(String(value || '').trim()), 'i')

const serializeUser = (user, opts = {}) => ({
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
    designation: user.designation,
    department: user?.department,
    education: user?.education,

    avatarUrl: user.avatarUrl,
    contactEmail: user.contactEmail,
    publicNote: user.publicNote,

    bussinessurl: user.bussinessurl,
    adimage: user.adimage,
    message: user.message,

    phone: opts.includePhone ? user.phone : null,
    alternatePhone: opts.includePhone ? user.alternatePhone : null,

    createdAt: user.createdAt,
    updatedAt: user.updatedAt
})

r.get('/foundpeople', auth, ah(async (req, res) => {
    const {
        page = 1,
        pageSize = 20,
        state, district, city, gotra, occupation, search, status, role,
        name, designation, department, address,
        from, to,
        sortBy = 'createdAt',
        sortDir = 'desc'
    } = req.query

    const parsedPage = Math.max(1, parseInt(page, 10) || 1)
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const and = []

    if (status) and.push({ status })
    if (role) and.push({ role })
    if (gotra) and.push({ 'gotra.self': gotra })
    if (occupation) and.push({ occupation })

    if (name) {
        const regex = makeRegex(name)
        and.push({ $or: [{ name: regex }, { displayName: regex }] })
    }
    if (designation) and.push({ designation: makeRegex(designation) })
    if (department) and.push({ department: makeRegex(department) })

    if (search) {
        const regex = makeRegex(search)
        and.push({
            $or: [
                { name: regex },
                { displayName: regex },
                { designation: regex },
                { department: regex },
                { referralCode: regex },
                { 'gotra.self': regex },
                { occupation: regex },
                { contactEmail: regex },
                { 'currentAddress.state': regex },
                { 'currentAddress.district': regex },
                { 'currentAddress.city': regex },
                { 'occupationAddress.state': regex },
                { 'occupationAddress.district': regex },
                { 'occupationAddress.city': regex },
                { 'parentalAddress.state': regex },
                { 'parentalAddress.district': regex },
                { 'parentalAddress.city': regex },
            ]
        })
    }

    if (address) {
        const regex = makeRegex(address)
        and.push({
            $or: [
                { 'currentAddress.currentaddress': regex },
                { 'currentAddress.village': regex },
                { 'currentAddress.city': regex },
                { 'currentAddress.district': regex },
                { 'currentAddress.state': regex },
                { 'occupationAddress.occupationaddress': regex },
                { 'occupationAddress.village': regex },
                { 'occupationAddress.city': regex },
                { 'occupationAddress.district': regex },
                { 'occupationAddress.state': regex },
                { 'parentalAddress.currentaddress': regex },
                { 'parentalAddress.village': regex },
                { 'parentalAddress.city': regex },
                { 'parentalAddress.district': regex },
                { 'parentalAddress.state': regex },
            ]
        })
    }

    if (state || district || city) {
        const addrPaths = ['currentAddress', 'occupationAddress', 'parentalAddress']
        const clauses = addrPaths.map((path) => {
            const clause = {}
            if (state) clause[`${path}.stateCode`] = state
            if (district) clause[`${path}.districtCode`] = district
            if (city) clause[`${path}.cityCode`] = city
            return clause
        }).filter((clause) => Object.keys(clause).length > 0)

        if (clauses.length > 0) {
            and.push({ $or: clauses })
        }
    }

    const filter = and.length > 0 ? { $and: and } : {}
    // if (from || to) {
    //   filter.createdAt = {}
    //   if (from) filter.createdAt.$gte = new Date(from)
    //   if (to) filter.createdAt.$lte = new Date(to)
    // }

    const allowedSortBy = new Set(['createdAt', 'name', 'role', 'occupation'])
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
            .limit(parsedPageSize)
            .lean(),
        User.countDocuments(filter)
    ])

    res.json({
        data: data.map((user) => serializeUser(user, { includePhone: false })),
        meta: {
            total,
            page: parsedPage,
            pageSize: parsedPageSize,
            sortBy: sortField,
            sortDir: sortOrder === 1 ? 'asc' : 'desc'
        }
    })
}))


// Secure user details for Found (phone only when approved by receiver)
r.get('/user/:id', auth, ah(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user id' })
    }

    const user = await User.findById(id).lean()
    if (!user) {
        return res.status(404).json({ error: 'User not found' })
    }

    const viewerId = String(req.user?._id || '')
    const targetId = String(user._id)
    let includePhone = false

    if (viewerId && viewerId === targetId) {
        includePhone = true
    } else if (viewerId) {
        const approved = await NumberRequest.findOne({
            senderId: req.user._id,
            receiverId: user._id,
            status: 'approved',
        }).select('_id').lean()
        includePhone = Boolean(approved)
    }

    res.json({
        person: serializeUser(user, { includePhone }),
        canViewPhone: includePhone,
    })
}))


/* ===============================
   1️⃣ SEND NUMBER REQUEST
================================ */
r.post("/request/send", auth, ah(async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ error: "Invalid receiverId" });
    }
    if (String(receiverId) === String(senderId)) {
        return res.status(400).json({ error: "Cannot request your own number" });
    }

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
