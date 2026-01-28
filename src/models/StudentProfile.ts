import mongoose, { Schema, Model } from "mongoose";
import { type IStudentProfile, ExperienceLevel } from "../types/index.js";

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    cvUrl: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    experienceLevel: {
      type: String,
      enum: Object.values(ExperienceLevel),
    },
    education: [
      {
        school: {
          type: String,
          required: true,
        },
        degree: {
          type: String,
          required: true,
        },
        year: {
          type: Number,
          required: true,
        },
      },
    ],
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes
studentProfileSchema.index({ userId: 1 });
studentProfileSchema.index({ skills: 1 });
studentProfileSchema.index({ experienceLevel: 1 });

const StudentProfile: Model<IStudentProfile> = mongoose.model<IStudentProfile>(
  "StudentProfile",
  studentProfileSchema,
);

export default StudentProfile;
