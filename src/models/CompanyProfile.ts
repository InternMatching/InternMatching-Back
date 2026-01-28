import mongoose, { Schema, Model } from "mongoose";
import { type ICompanyProfile } from "../types/index.js";

const companyProfileSchema = new Schema<ICompanyProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    industry: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    website: {
      type: String,
      trim: true,
    },
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
companyProfileSchema.index({ userId: 1 });
companyProfileSchema.index({ isVerified: 1 });
companyProfileSchema.index({ companyName: 1 });

const CompanyProfile: Model<ICompanyProfile> = mongoose.model<ICompanyProfile>(
  "CompanyProfile",
  companyProfileSchema,
);

export default CompanyProfile;
