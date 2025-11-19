import mongoose from "mongoose";

const gauravSchema = new mongoose.Schema({
  name: String,
  title: String,
  timeline: { type: String, enum: ["PAST", "PRESENT"], default: "PAST" },
  category: String,
  biography: String,
  achievements: [String],
  photo: String,
  gallery: [String],
  visible: { type: Boolean, default: true },
}, { timestamps: true });

export const gauravs = mongoose.model("gauravs", gauravSchema);
