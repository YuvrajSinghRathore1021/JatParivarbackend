// backend/src/routes/jobs.routes.js
import { Router } from 'express'
import mongoose from 'mongoose'
import { auth } from '../middleware/auth.js'
import { ah } from '../utils/asyncHandler.js'
import { JobPost } from '../models/JobPost.js'
import { JobApplication } from '../models/JobApplication.js'

const r = Router()

r.get(
  '/',
  ah(async (req, res) => {
    const list = await JobPost.find({ approved: true })
      .sort('-createdAt')
      .limit(100)

    res.json(
      list.map((job) => ({
        id: job._id,
        title: job.title,
        description: job.description,
        locationState: job.locationState,
        locationDistrict: job.locationDistrict,
        locationCity: job.locationCity,
        type: job.type,
        salaryRange: job.salaryRange,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        approved: job.approved,
        posterId: job.userId,
      }))
    )
  })
)

r.get(
  '/mine',
  auth,
  ah(async (req, res) => {
    const jobs = await JobPost.find({ userId: req.user._id })
      .sort('-createdAt')

    const applications = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
      { $group: { _id: '$jobId', count: { $sum: 1 } } },
    ])
    const appCount = new Map(applications.map((row) => [String(row._id), row.count]))

    res.json(
      jobs.map((job) => ({
        id: job._id,
        title: job.title,
        description: job.description,
        locationState: job.locationState,
        locationDistrict: job.locationDistrict,
        locationCity: job.locationCity,
        type: job.type,
        salaryRange: job.salaryRange,
        contactPhone: job.contactPhone,
        approved: job.approved,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        applicants: appCount.get(String(job._id)) || 0,
      }))
    )
  })
)

r.get(
  '/:id',
  auth,
  ah(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }

    const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id })
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json(job)
  })
)

r.post(
  '/',
  auth,
  ah(async (req, res) => {
    const payload = (({
      title,
      description,
      locationState,
      locationDistrict,
      locationCity,
      type,
      salaryRange,
      contactPhone,
    }) => ({
      title,
      description,
      locationState,
      locationDistrict,
      locationCity,
      type,
      salaryRange,
      contactPhone,
    }))(req.body || {})

    const j = await JobPost.create({ ...payload, userId: req.user._id, approved: false })
    res.json(j)
  })
)

r.patch(
  '/:id',
  auth,
  ah(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }

    const payload = (({
      title,
      description,
      locationState,
      locationDistrict,
      locationCity,
      type,
      salaryRange,
      contactPhone,
    }) => ({
      title,
      description,
      locationState,
      locationDistrict,
      locationCity,
      type,
      salaryRange,
      contactPhone,
    }))(req.body || {})

    const job = await JobPost.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: payload },
      { new: true }
    )

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json(job)
  })
)

r.post(
  '/:id/applications',
  auth,
  ah(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }

    const job = await JobPost.findById(req.params.id)
    if (!job || !job.approved) {
      return res.status(404).json({ error: 'Job not available' })
    }

    if (String(job.userId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot apply to your own job' })
    }

    const payload = (({ coverLetter, expectedSalary }) => ({ coverLetter, expectedSalary }))(req.body || {})

    const application = await JobApplication.findOneAndUpdate(
      { jobId: job._id, applicantId: req.user._id },
      { $set: payload },
      { new: true, upsert: true }
    )

    res.json(application)
  })
)

r.get(
  '/:id/applications',
  auth,
  ah(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid job id' })
    }

    const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id })
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const applications = await JobApplication.find({ jobId: job._id })
      .sort('-createdAt')
      .populate('applicantId', 'displayName name phone email occupation company avatarUrl publicNote')

    res.json(
      applications.map((app) => ({
        id: app._id,
        status: app.status,
        coverLetter: app.coverLetter,
        expectedSalary: app.expectedSalary,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        applicant: app.applicantId
          ? {
              id: app.applicantId._id,
              displayName: app.applicantId.displayName || app.applicantId.name,
              phone: app.applicantId.phone,
              email: app.applicantId.email,
              occupation: app.applicantId.occupation,
              company: app.applicantId.company,
              avatarUrl: app.applicantId.avatarUrl,
              publicNote: app.applicantId.publicNote,
            }
          : null,
      }))
    )
  })
)

export default r
