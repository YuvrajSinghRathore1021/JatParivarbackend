// backend/src/models/JobApplication.js
import mongoose from 'mongoose'

export const JobApplication = mongoose.model(
  'JobApplication',
  new mongoose.Schema(
    {
      jobId: { type: mongoose.Types.ObjectId, ref: 'JobPost', index: true },
      applicantId: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
      coverLetter: String,
      expectedSalary: String,
      status: {
        type: String,
        enum: ['submitted', 'shortlisted', 'rejected'],
        default: 'submitted',
      },
    },
    { timestamps: true }
  ).index({ jobId: 1, applicantId: 1 }, { unique: true })
)
