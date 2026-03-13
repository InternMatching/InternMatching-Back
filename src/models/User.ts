import mongoose, { Schema, Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import { type IUser, UserRole } from "../types/index.js";

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value: string) => validator.isEmail(value),
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, "User role is required"],
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    themeColor: {
      type: String,
      default: "#3b82f6", // Default blue
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash the password if it exists and has been modified (or is new)
  if (!this.password || !this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Create indexes
userSchema.index({ email: 1 });

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default User;
