import mongoose, { Schema, Document } from "mongoose";
import { InvitationStatus } from "../types/index.js";

export interface IInvitation extends Document {
  companyProfileId: mongoose.Types.ObjectId;
  studentProfileId: mongoose.Types.ObjectId;
  message?: string;
  status: InvitationStatus;
  sentAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema: Schema = new Schema(
  {
    companyProfileId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyProfile",
      required: true,
    },
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    message: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(InvitationStatus),
      default: InvitationStatus.PENDING,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IInvitation>("Invitation", InvitationSchema);
