import mongoose, { Schema, Document } from "mongoose";
import { ExperienceLevel, JobStatus } from "../../types/index.js";

export interface IJob extends Document {
  companyProfileId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  type: ExperienceLevel;
  requiredSkills: string[];
  location?: string;
  salaryRange?: string;
  responsibilities?: string;
  requirements?: string;
  additionalInfo?: string;
  deadline?: Date;
  maxParticipants?: number;
  status: JobStatus;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    companyProfileId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyProfile",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: Object.values(ExperienceLevel),
      required: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      trim: true,
    },
    salaryRange: {
      type: String,
      trim: true,
    },
    responsibilities: {
      type: String,
    },
    requirements: {
      type: String,
    },
    additionalInfo: {
      type: String,
    },
    deadline: {
      type: Date,
    },
    maxParticipants: {
      type: Number,
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.OPEN,
    },
    postedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance
JobSchema.index({ status: 1, postedAt: -1 });
JobSchema.index({ companyProfileId: 1 });

export default mongoose.model<IJob>("Job", JobSchema);
