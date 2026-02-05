import mongoose, { Schema, Document } from "mongoose";
import { ExperienceLevel, JobStatus } from "../types/index.js";

export interface IJob extends Document {
  companyProfileId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  type: ExperienceLevel;
  requiredSkills: string[];
  location?: string;
  salaryRange?: string;
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

export default mongoose.model<IJob>("Job", JobSchema);
