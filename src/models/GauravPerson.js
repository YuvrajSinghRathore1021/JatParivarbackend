// import mongoose from "mongoose";

// const gauravSchema = new mongoose.Schema({
//   name: String,
//   title: String,
//   timeline: { type: String, enum: ["PAST", "PRESENT"], default: "PAST" },
//   category: String,
//   biography: String,
//   achievements: [String],
//   photo: String,
//   gallery: [String],
//   visible: { type: Boolean, default: true },
// }, { timestamps: true });

// export const gauravs = mongoose.model("gauravs", gauravSchema);




import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema({
  timeline: { type: String, enum: ["PAST", "PRESENT"], required: true },
  category: { type: String, default: "games" },
  biography: { type: String, default: "" },
  achievements: { type: [String], default: [""] },
  gallery: { type: [String], default: [] }
}, { _id: false });

const gauravSchema = new mongoose.Schema(
  {
    name: String,
    title: String,
    photo: String,
    visible: { type: Boolean, default: true },

    data: { type: sectionSchema, default: () => ({ timeline: "PRESENT" }) }
  },
  { timestamps: true }
);

export const gauravs = mongoose.model("gauravs", gauravSchema);

