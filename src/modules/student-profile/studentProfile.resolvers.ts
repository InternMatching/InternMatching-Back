import StudentProfile from "./studentProfile.model.js";
import User from "../auth/auth.model.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { type Context, UserRole, ExperienceLevel } from "../../types/index.js";
import { GraphQLError } from "graphql";
import { uploadToCloudinary } from "../../utils/cloudinary.js";
import { suggestSkillsForStudent } from "../../utils/aiSkillSuggester.js";
import { parseCV } from "../../utils/aiCV.js";
import { reviewCV } from "../../utils/aiCVReview.js";

export interface StudentProfileInput {
  firstName?: string;
  lastName?: string;
  skills?: string[];
  cvUrl?: string;
  profilePictureUrl?: string;
  bio?: string;
  experienceLevel?: ExperienceLevel;
  education?: {
    school: string;
    degree: string;
    year: number;
  }[];
}

export const studentProfileResolvers = {
  Query: {
    /**
     * Get student profile by userId
     * If no userId provided, return current user's profile
     */
    getStudentProfile: async (
      _: any,
      { userId }: { userId?: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // If no userId provided, use current user's ID
      const targetUserId = userId || user.userId;

      // Students can only view their own profile unless they're admin
      if (user.role === UserRole.STUDENT && targetUserId !== user.userId) {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const profile = await StudentProfile.findOne({ userId: targetUserId });

      if (!profile) {
        return null;
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        profilePictureUrl: profile.profilePictureUrl,
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        isActivelyLooking: profile.isActivelyLooking ?? true,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Get all student profiles (for companies and admins)
     */
    getAllStudentProfiles: async (_: any, __: any, context: Context) => {
      requireRole(context, [UserRole.COMPANY, UserRole.ADMIN]);

      const profiles = await StudentProfile.find();

      return profiles.map((profile: any) => ({
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        profilePictureUrl: profile.profilePictureUrl,
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        isActivelyLooking: profile.isActivelyLooking ?? true,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      }));
    },
  },

  Mutation: {
    /**
     * Create student profile
     */
    createStudentProfile: async (
      _: any,
      { input }: { input: StudentProfileInput },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.STUDENT]);

      // Check if profile already exists
      const existingProfile = await StudentProfile.findOne({
        userId: user.userId,
      });

      if (existingProfile) {
        throw new GraphQLError("Student profile already exists", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Create new profile
      const profile = await StudentProfile.create({
        userId: user.userId,
        ...input,
        updatedAt: new Date(),
      });

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        isActivelyLooking: profile.isActivelyLooking ?? true,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Update student profile
     */
    updateStudentProfile: async (
      _: any,
      { input }: { input: StudentProfileInput },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.STUDENT]);

      // Find and update profile (acting as upsert)
      const profile = await StudentProfile.findOneAndUpdate(
        { userId: user.userId },
        {
          $set: {
            ...input,
            updatedAt: new Date(),
          },
        },
        { new: true, runValidators: true, upsert: true },
      );

      if (!profile) {
        throw new GraphQLError(
          "Could not update or create student profile.",
          {
            extensions: { code: "SERVER_ERROR" },
          },
        );
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        profilePictureUrl: profile.profilePictureUrl,
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        isActivelyLooking: profile.isActivelyLooking ?? true,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Suggest skills for the current student based on their profile (AI).
     */
    suggestSkillsForMyProfile: async (
      _: any,
      __: any,
      context: Context,
    ): Promise<string[]> => {
      const user = requireRole(context, [UserRole.STUDENT]);

      const profile = await StudentProfile.findOne({ userId: user.userId });

      const bio = profile?.bio?.trim() || "";
      const education = profile?.education ?? [];

      if (!bio && education.length === 0) {
        throw new GraphQLError(
          "Эхлээд намтар эсвэл боловсролоо нэмнэ үү",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }

      return suggestSkillsForStudent(
        {
          bio,
          experienceLevel: profile?.experienceLevel,
          education: education.map((e: any) => ({
            school: e.school,
            degree: e.degree,
            year: e.year,
            status: e.status,
          })),
        },
        profile?.skills ?? [],
      );
    },

    /**
     * Upload student profile picture
     */
    uploadStudentProfilePicture: async (
      _: any,
      { base64Image }: { base64Image: string },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.STUDENT]);

      // Upload to Cloudinary — use userId as stable public_id so re-uploads overwrite
      const profilePictureUrl = await uploadToCloudinary(
        base64Image,
        "internmatch/profiles",
        `profile_${user.userId}`,
      );

      // Save URL to the student profile
      const profile = await StudentProfile.findOneAndUpdate(
        { userId: user.userId },
        { $set: { profilePictureUrl, updatedAt: new Date() } },
        { new: true, upsert: true },
      );

      if (!profile) {
        throw new GraphQLError("Student profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        profilePictureUrl: profile.profilePictureUrl,
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        isActivelyLooking: profile.isActivelyLooking ?? true,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Parse a CV PDF using Claude AI and return structured profile data.
     * Limited to 3 parses per calendar day per student.
     */
    parseCV: async (
      _: any,
      { base64PDF }: { base64PDF: string },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.STUDENT]);

      if (!base64PDF || base64PDF.length < 100) {
        throw new GraphQLError("Invalid PDF data", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Rough size guard: base64 of 5MB PDF ≈ 6.8MB string
      if (base64PDF.length > 7_000_000) {
        throw new GraphQLError("PDF too large. Please upload a file under 5MB.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const CV_DAILY_LIMIT = 3;

      const profile = await StudentProfile.findOne({ userId: user.userId });

      if (profile) {
        const today = new Date();
        const parseDate = profile.cvParseDate;
        const isSameDay =
          parseDate &&
          parseDate.getFullYear() === today.getFullYear() &&
          parseDate.getMonth() === today.getMonth() &&
          parseDate.getDate() === today.getDate();

        const count = isSameDay ? (profile.cvParseCount ?? 0) : 0;

        if (count >= CV_DAILY_LIMIT) {
          throw new GraphQLError(
            "Өдөрт CV задлах хязгаарт хүрлээ. Маргааш дахин оролдоно уу.",
            { extensions: { code: "CV_PARSE_LIMIT_EXCEEDED" } },
          );
        }

        await StudentProfile.updateOne(
          { userId: user.userId },
          {
            $set: {
              cvParseCount: count + 1,
              cvParseDate: isSameDay ? parseDate : today,
            },
          },
        );
      }

      return parseCV(base64PDF);
    },

    /**
     * Review a CV PDF using Claude AI and return professional feedback in Mongolian.
     * Public — no auth required.
     */
    reviewCV: async (
      _: any,
      { base64PDF }: { base64PDF: string },
      context: Context,
    ) => {
      requireAuth(context);
      if (!base64PDF || base64PDF.length < 100) {
        throw new GraphQLError("Invalid PDF data", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (base64PDF.length > 7_000_000) {
        throw new GraphQLError("PDF too large. Please upload a file under 5MB.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        return await reviewCV(base64PDF);
      } catch (err) {
        console.error("[reviewCV resolver]", err);
        throw new GraphQLError(
          err instanceof Error ? err.message : "CV шүүмжлэхэд алдаа гарлаа.",
          { extensions: { code: "INTERNAL_SERVER_ERROR" } },
        );
      }
    },
  },

  StudentProfile: {
    user: async (parent: any) => {
      const user = await User.findById(parent.userId);
      if (!user) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber || null,
        createdAt: user.createdAt.toISOString(),
      };
    },
  },
};
