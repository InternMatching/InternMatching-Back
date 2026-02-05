import mongoose, { Schema, Document } from "mongoose";
import { ApplicationStatus } from "../types/index.js";

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  studentProfileId: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  matchScore: number;
  coverLetter?: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema: Schema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.APPLIED,
    },
    matchScore: {
      type: Number,
      default: 0,
    },
    coverLetter: {
      type: String,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IApplication>("Application", ApplicationSchema);
