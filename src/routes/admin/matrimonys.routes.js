



import { Router } from "express";
import { MatrimonyProfile } from "../../models/MatrimonyProfile.js";
import { requireRole } from "../../middleware/adminAuth.js";
import { ah } from "../../utils/asyncHandler.js";

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

// router.post(
//   "/save",
//   requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
//   ah(async (req, res) => {
//     const {
//       id,
//       age,
//       gender,
//       maritalStatus,
//       education,
//       occupation,
//       state,
//       district,
//       city,
//       village,
//       gotra,
//       photos,
//       visible,
//       height,
//     } = req.body || {};

//     // ----------------------------
//     // SAFE GOTRA
//     // ----------------------------
//     const safeGotra = {
//       self: gotra?.self || "",
//       mother: gotra?.mother || "",
//       nani: gotra?.nani || "",
//       dadi: gotra?.dadi || "",
//     };

//     // ----------------------------
//     // SANITIZED DATA
//     // ----------------------------
//     const data = {
//       age,
//       gender,
//       maritalStatus,
//       education,
//       occupation,
//       state,
//       district,
//       city,
//       village,
//       height,
//       gotra: safeGotra,
//       photos: Array.isArray(photos) ? photos : [],
//       visible: visible ?? true,
//     };

//     let profile;

//     // =====================================
//     // UPDATE PROFILE (If ID present)
//     // =====================================
//     if (id && id !== "save") {
//       // Validate MongoDB ObjectID
//       if (!/^[0-9a-fA-F]{24}$/.test(id)) {
//         return res.status(400).json({ error: "Invalid profile ID" });
//       }

//       profile = await MatrimonyProfile.findByIdAndUpdate(
//         id,
//         { $set: data },
//         { new: true }
//       );

//       if (!profile) {
//         return res.status(404).json({ error: "Profile not found" });
//       }
//     }

//     // =====================================
//     // CREATE NEW PROFILE (No ID)
//     // =====================================
//     else {
//       profile = await MatrimonyProfile.create({
//         ...data,
//         userId: null, // Admin-created profile
//       });
//     }

//     return res.json(profile);
//   })
// );


router.post("/save", requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const {
    id,
    age, gender, maritalStatus, education, occupation,
    state, district, city, village,
    gotra, photos, visible, height
  } = req.body || {};

  // Data without userId — admin must not overwrite it
  const data = {
    age,
    gender,
    maritalStatus,
    education,
    occupation,
    state,
    district,
    city,
    village,
    height,
    gotra,
    photos,
    visible,
  };

  let profile;

  // ============================
  // If ID exists → UPDATE
  // ============================
  if (id && id !='save') {
    profile = await MatrimonyProfile.findByIdAndUpdate(
      id,
      { $set: data },    // DO NOT update userId
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
      userId: null      // keep user id blank
    });
  }

  res.json(profile);
}));

export default router;

