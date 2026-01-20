



import { Router } from "express";
import mongoose from "mongoose";
import { MatrimonyProfile } from "../../models/MatrimonyProfile.js";
import { requireRole } from "../../middleware/adminAuth.js";
import { ah } from "../../utils/asyncHandler.js";
import { User } from "../../models/User.js";
import { normalizeReferralCode } from "../../utils/referral.js";

const router = Router();



// =============================
// ADMIN: Get Profiles (Search)
// =============================
router.get("/", requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { search = "" } = req.query;

  const filter = search
    ? {
      $or: [
        { titleEn: new RegExp(search, "i") },
        { titleHi: new RegExp(search, "i") },
        { city: new RegExp(search, "i") },
        { state: new RegExp(search, "i") }
      ]
    }
    : {};

  const list = await MatrimonyProfile.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ data: list });
}));


// =============================
// ADMIN: Update (Approve/Publish)
// =============================
router.patch("/:id", requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const updated = await MatrimonyProfile.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );

  res.json(updated);
}));


// =============================
// ADMIN: Delete Profile
// =============================
router.delete("/:id", requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  await MatrimonyProfile.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));





// view and edit 
router.get('/profiles', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const id = req.query.id;
  const profile = await MatrimonyProfile.findOne({ _id: req.query.id }).lean()
  if (!profile) {
    return res.status(404).json({ error: "Profile not found" });
  }

  res.json(profile);
}))



// =============================
// USER: Create / Update Profile
// =============================


router.post("/save", requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const {
    id,
    age, gender, maritalStatus, education, occupation,
    gotra, photos, visible, height, name, address, parentaladdress, designation, department,
    userId,
    referralCode,
    occupationAddress = {},
    currentAddress = {},
    parentalAddress = {},
  } = req.body || {};

  let linkedUserId = null;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(400).json({ error: "User not found for provided userId" });
    }
    linkedUserId = userId;
  } else if (referralCode) {
    const code = normalizeReferralCode(referralCode);
    if (!code) return res.status(400).json({ error: "Invalid referral code" });
    const user = await User.findOne({ referralCode: code }).select('_id');
    if (!user) {
      return res.status(400).json({ error: "User not found for provided referral code" });
    }
    linkedUserId = user._id;
  }

  // Data without userId — admin must not overwrite it
  const data = {
    age,
    gender,
    maritalStatus,
    education, designation, department,
    occupation,
    state,
    district,
    city,
    village,
    height,
    gotra,
    photos,
    visible,
    name, address, parentaladdress,
    occupationAddress,
    currentAddress,
    parentalAddress,
    ...(linkedUserId ? { userId: linkedUserId } : {})
  };

  let profile;

  // ============================
  // If ID exists → UPDATE
  // ============================
  if (id && id !='save') {
    profile = await MatrimonyProfile.findByIdAndUpdate(
      id,
      { $set: data },    // allow updating userId when provided
      { new: true, upsert: false }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
  }

  // ============================
  // If NO ID → CREATE NEW PROFILE
  // ============================
  else {
    profile = await MatrimonyProfile.create({
      ...data,
      userId: linkedUserId      // optionally link an existing user
    });
  }

  res.json(profile);
}));

export default router;

