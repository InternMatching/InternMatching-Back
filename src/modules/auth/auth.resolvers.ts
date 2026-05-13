import User from "./auth.model.js";
import { generateToken } from "../../utils/jwt.js";
import { type Context, UserRole, type AuthResponse } from "../../types/index.js";
import { GraphQLError } from "graphql";
import crypto from "crypto";
import { sendEmail } from "../../utils/email.js";

export interface SignupInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authResolvers = {
  Query: {
    /**
     * Get current authenticated user
     */
    me: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const user = await User.findById(context.user.userId);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      };
    },

    /**
     * Get user by ID (admin only)
     */
    getUser: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENICATED" },
        });
      }

      // Only admins can get other users
      if (context.user.role !== UserRole.ADMIN && context.user.userId !== id) {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const user = await User.findById(id);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      };
    },
  },

  Mutation: {
    /**
     * User signup
     */
    signup: async (
      _: any,
      { input }: { input: SignupInput },
    ): Promise<AuthResponse> => {
      const { email, password, role } = input;

      // Validate input
      if (!email || !password || !role) {
        throw new GraphQLError("All fields are required", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      if (password.length < 6) {
        throw new GraphQLError("Password must be at least 6 characters long", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        throw new GraphQLError("User with this email already exists", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Create new user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        role,
      });

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    /**
     * User login
     */
    login: async (
      _: any,
      { input }: { input: LoginInput },
    ): Promise<AuthResponse> => {
      const { email, password } = input;

      // Validate input
      if (!email || !password) {
        throw new GraphQLError("Email and password are required", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Find user by email (include password field)
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password",
      );

      if (!user) {
        throw new GraphQLError("Invalid email or password", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        throw new GraphQLError("Invalid email or password", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    /**
     * Request a password reset
     */
    requestPasswordReset: async (_: any, { email }: { email: string }) => {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log(`[Auth] Password reset requested for UNKNOWN email: ${email}`);
        return true;
      }

      console.log(`[Auth] User found: ${user.email}. Generating reset token...`);

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hash token and set expiry (1 hour)
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

      const message = `Нууц үгээ сэргээхийн тулд дараах линкээр орж шинээр нууц үг оруулна уу: ${resetUrl}.\nХэрэв та нууц үгээ сэргээх хүсэлт илгээгээгүй бол spam folder-оо шалгаарай!`;
      try {
        await sendEmail({
          email: user.email,
          subject: "Нууц үг сэргээх хүсэлт",
          message,
        });

        return true;
      } catch (error: any) {
        console.error("Password reset email error:", error);
        
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save({ validateBeforeSave: false });

        // Surface the specific error message to help with debugging (e.g., Resend's 450 error)
        throw new GraphQLError(`Email Error: ${error.message || "There was an error sending the email. Try again later"}`, {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    /**
     * Social login (Google, GitHub)
     */
    socialLogin: async (
      _: any,
      { input }: { input: any },
    ): Promise<AuthResponse> => {
      const { email, socialId, provider, role, firstName, lastName, profilePictureUrl } = input;

      // Find user by email
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Create new social user
        user = await User.create({
          email: email.toLowerCase(),
          role: role || UserRole.STUDENT,
          googleId: provider === "google" ? socialId : undefined,
          githubId: provider === "github" ? socialId : undefined,
        });

        // If it's a student, create an initial profile
        if (user.role === UserRole.STUDENT) {
          const { default: StudentProfile } = await import("../student-profile/studentProfile.model.js");
          await StudentProfile.create({
            userId: user._id,
            firstName: firstName || "",
            lastName: lastName || "",
            profilePictureUrl: profilePictureUrl || "",
            skills: [],
          });
        }
      } else {
        // If user exists, link social ID if not already linked
        let updated = false;
        if (provider === "google" && !user.googleId) {
          user.googleId = socialId;
          updated = true;
        } else if (provider === "github" && !user.githubId) {
          user.githubId = socialId;
          updated = true;
        }

        if (updated) {
          await user.save({ validateBeforeSave: false });
        }
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    /**
     * GitHub OAuth login
     */
    githubLogin: async (
      _: any,
      { code, role }: { code: string; role?: UserRole },
    ): Promise<AuthResponse> => {
      // 1. Exchange code for access token
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new GraphQLError(`GitHub Auth Error: ${tokenData.error_description}`, {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // 2. Fetch user profile
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const githubUser = await userRes.json();

      // 3. Fetch user email (GitHub might not return it in the main profile)
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

      // 4. Find or Create User
      let user = await User.findOne({ email: primaryEmail.toLowerCase() });

      if (!user) {
        user = await User.create({
          email: primaryEmail.toLowerCase(),
          role: role || UserRole.STUDENT,
          githubId: githubUser.id.toString(),
        });

        if (user.role === UserRole.STUDENT) {
          const { default: StudentProfile } = await import("../student-profile/studentProfile.model.js");
          await StudentProfile.create({
            userId: user._id,
            firstName: githubUser.name?.split(" ")[0] || githubUser.login,
            lastName: githubUser.name?.split(" ").slice(1).join(" ") || "",
            profilePictureUrl: githubUser.avatar_url,
            skills: [],
          });
        }
      } else {
        if (!user.githubId) {
          user.githubId = githubUser.id.toString();
          await user.save({ validateBeforeSave: false });
        }
      }

      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    /**
     * Reset password
     */
    resetPassword: async (
      _: any,
      { token, newPassword }: { token: string; newPassword: string },
    ) => {
      // Get hashed token
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Find user with token and check expiry
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
      }).select("+password");

      if (!user) {
        throw new GraphQLError("Token  invalid or has expired", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Update password
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      return true;
    },

    updateUserRole: async (
      _: any,
      { userId, role }: { userId: string; role: string },
      context: Context
    ) => {
      if (!context.user || context.user.role !== UserRole.ADMIN) {
        throw new GraphQLError("Only admins can update user roles", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true }
      );

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      };
    },
  },
};
