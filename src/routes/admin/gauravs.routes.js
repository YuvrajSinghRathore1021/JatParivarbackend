// import { Router } from "express";
// import { gauravs } from "../../models/GauravPerson.js";
// import { requireRole } from "../../middleware/adminAuth.js";
// import { ah } from "../../utils/asyncHandler.js";

// const router = Router();

// /* ==========================================
//    ADMIN: GET LIST (Filters + Search)
// ========================================== */
// router.get("/", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {
//   const {
//     search = "",
//     timeline,
//     category
//   } = req.query;

//   const filter = {};

//   if (timeline) filter.timeline = timeline;
//   if (category) filter.category = category;

//   if (search) {
//     filter.$or = [
//       { name: new RegExp(search, "i") },
//       { title: new RegExp(search, "i") },
//       { biography: new RegExp(search, "i") }
//     ];
//   }

//   const list = await gauravs
//     .find(filter)
//     .sort({ createdAt: -1 })
//     .lean();

//   res.json({ data: list });
// }));


// /* ==========================================
//    ADMIN: GET ONE PROFILE
// ========================================== */
// router.get("/:id", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {
//   const profile = await gauravs.findById(req.params.id).lean();
//   if (!profile) return res.status(404).json({ error: "Profile not found" });
//   res.json(profile);
// }));


// /* ==========================================
//    ADMIN: CREATE NEW PROFILE
// ========================================== */
// router.post("/", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {
//   const {
//     name,
//     title,
//     timeline,
//     category,
//     biography,
//     achievements,
//     photo,
//     gallery,
//     visible
//   } = req.body;

//   const profile = await gauravs.create({
//     name,
//     title,
//     timeline,
//     category,
//     biography,
//     achievements: achievements || [],
//     photo,
//     gallery: gallery || [],
//     visible
//   });

//   res.json(profile);
// }));


// /* ==========================================
//    ADMIN: UPDATE PROFILE
// ========================================== */
// router.patch("/:id", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {
//   const allowed = ["name", "title", "timeline", "category", "biography", "achievements", "photo", "gallery", "visible"];

//   const data = {};
//   for (const key of allowed) {
//     if (req.body[key] !== undefined) data[key] = req.body[key];
//   }

//   const updated = await gauravs.findByIdAndUpdate(
//     req.params.id, { $set: data }, { new: true }
//   );

//   res.json(updated);
// }));


// /* ==========================================
//    ADMIN: DELETE PROFILE
// ========================================== */
// router.delete("/:id", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {
//   await gauravs.findByIdAndDelete(req.params.id);
//   res.json({ success: true });
// }));




// // =======================================
// // ADMIN: CREATE or UPDATE (gaurav/save)
// // =======================================
// router.post("/save", requireRole("SUPER_ADMIN", "CONTENT_ADMIN"), ah(async (req, res) => {

//   const {
//     id,
//     name,
//     title,
//     timeline,
//     category,
//     biography,
//     achievements,
//     photo,
//     gallery,
//     visible
//   } = req.body;

//   const data = {
//     name,
//     title,
//     timeline,
//     category,
//     biography,
//     achievements: achievements || [],
//     photo,
//     gallery: gallery || [],
//     visible
//   };

//   let profile;

//   // ===========================
//   // UPDATE
//   // ===========================
//   if (id && id !== "save") {
//     profile = await gauravs.findByIdAndUpdate(
//       id,
//       { $set: data },
//       { new: true }
//     );

//     if (!profile) {
//       return res.status(404).json({ error: "Profile not found" });
//     }
//   }

//   // ===========================
//   // CREATE NEW
//   // ===========================
//   else {
//     profile = await gauravs.create(data);
//   }

//   res.json(profile);
// }));


// export default router;










import { Router } from "express";
import { gauravs } from "../../models/GauravPerson.js";
import { requireRole } from "../../middleware/adminAuth.js";
import { ah } from "../../utils/asyncHandler.js";

const router = Router();

/* ==========================================
   ADMIN: LIST (FILTERS)
========================================== */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    const { search = "", timeline, category } = req.query;

    const filter = {};

    // timeline filter (present.timeline or past.timeline)
    if (timeline) {
      filter.$or = [
        { "present.timeline": timeline },
        { "past.timeline": timeline }
      ];
    }

    // category filter
    if (category) {
      filter.$or = [
        { "present.category": category },
        { "past.category": category }
      ];
    }

    // search
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { title: new RegExp(search, "i") },
        { "present.biography": new RegExp(search, "i") },
        { "past.biography": new RegExp(search, "i") }
      ];
    }

    const list = await gauravs
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: list });
  })
);

/* ==========================================
   ADMIN: GET ONE
========================================== */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    const profile = await gauravs.findById(req.params.id).lean();
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  })
);

/* ==========================================
   ADMIN: CREATE NEW
========================================== */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    const { name, title, visible, present, photo, past } = req.body;

    const profile = await gauravs.create({
      name,
      title,
      visible, photo,
      present,
      past
    });

    res.json(profile);
  })
);

/* ==========================================
   ADMIN: UPDATE PROFILE
========================================== */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    const allowed = ["name", "title", "photo", "present", "past", "visible"];

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const updated = await gauravs.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true }
    );

    res.json(updated);
  })
);

/* ==========================================
   ADMIN: DELETE PROFILE
========================================== */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    await gauravs.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);

/* ==========================================
   ADMIN: SAVE (CREATE OR UPDATE)
========================================== */
router.post(
  "/save",
  requireRole("SUPER_ADMIN", "CONTENT_ADMIN"),
  ah(async (req, res) => {
    const { id, name, title, visible, present, photo, past } = req.body;

    const data = {
      name,
      title,
      visible,
      present,
      photo,
      past
    };

    let profile;

    // UPDATE
    if (id && id !== "save") {
      profile = await gauravs.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true }
      );

      if (!profile)
        return res.status(404).json({ error: "Profile not found" });
    }

    // CREATE
    else {
      profile = await gauravs.create(data);
    }

    res.json(profile);
  })
);

export default router;

