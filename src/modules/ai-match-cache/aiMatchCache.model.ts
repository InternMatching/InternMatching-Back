import mongoose, { Schema, Document } from "mongoose";

export interface IAIMatchCache extends Document {
  studentProfileId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: "hire" | "maybe" | "pass";
  studentProfileUpdatedAt: Date;
  jobUpdatedAt: Date;
  computedAt: Date;
}

const AIMatchCacheSchema: Schema = new Schema(
  {
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    score: { type: Number, required: true },
    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    recommendation: {
      type: String,
      enum: ["hire", "maybe", "pass"],
      default: "maybe",
    },
    studentProfileUpdatedAt: { type: Date, required: true },
    jobUpdatedAt: { type: Date, required: true },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

AIMatchCacheSchema.index(
  { studentProfileId: 1, jobId: 1 },
  { unique: true },
);

export default mongoose.model<IAIMatchCache>(
  "AIMatchCache",
  AIMatchCacheSchema,
);
