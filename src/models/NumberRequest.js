// import mongoose from "mongoose";

// const NumberRequestSchema = new mongoose.Schema({
//   senderId: String,
//   receiverId: String,
//   status: { type: String, default: "pending" },
//   createdAt: { type: Date, default: Date.now },
// });

// export default mongoose.model("NumberRequest", NumberRequestSchema);


import mongoose from "mongoose";

const NumberRequestSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("NumberRequest", NumberRequestSchema);

