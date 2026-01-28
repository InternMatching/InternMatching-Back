import StudentProfile from "../../models/StudentProfile.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { type Context, UserRole, ExperienceLevel } from "../../types/index.js";
import { GraphQLError } from "graphql";

export interface StudentProfileInput {
  firstName?: string;
  lastName?: string;
  skills?: string[];
  cvUrl?: string;
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
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
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
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
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

      // Find and update profile
      const profile = await StudentProfile.findOneAndUpdate(
        { userId: user.userId },
        {
          ...input,
          updatedAt: new Date(),
        },
        { new: true, runValidators: true },
      );

      if (!profile) {
        throw new GraphQLError(
          "Student profile not found. Please create one first.",
          {
            extensions: { code: "NOT_FOUND" },
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
        bio: profile.bio,
        experienceLevel: profile.experienceLevel,
        education: profile.education,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },
  },
};
