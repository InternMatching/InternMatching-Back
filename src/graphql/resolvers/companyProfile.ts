import CompanyProfile from "../../models/CompanyProfile.js";
import User from "../../models/User.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { type Context, UserRole } from "../../types/index.js";
import { GraphQLError } from "graphql";

export interface CompanyProfileInput {
  companyName: string;
  description?: string;
  industry?: string;
  location?: string;
  logoUrl?: string;
  website?: string;
}

export const companyProfileResolvers = {
  Query: {
    /**
     * Get company profile by userId
     * If no userId provided, return current user's profile
     */
    getCompanyProfile: async (
      _: any,
      { userId }: { userId?: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // If no userId provided, use current user's ID
      const targetUserId = userId || user.userId;

      // Companies can only view their own profile unless they're admin
      if (user.role === UserRole.COMPANY && targetUserId !== user.userId) {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const profile = await CompanyProfile.findOne({ userId: targetUserId });

      if (!profile) {
        return null;
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        companyName: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        location: profile.location,
        logoUrl: profile.logoUrl,
        isVerified: profile.isVerified,
        website: profile.website,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Get all company profiles
     */
    getAllCompanyProfiles: async (
      _: any,
      { verifiedOnly }: { verifiedOnly?: boolean },
      context: Context,
    ) => {
      requireAuth(context);

      // 1. Get all users with role COMPANY
      const companyUsers = await User.find({ role: UserRole.COMPANY });

      // 2. Get all existing profiles
      const query = verifiedOnly ? { isVerified: true } : {};
      const profiles = await CompanyProfile.find(query);

      // 3. Map company users to their profiles (or create a skeleton if profile missing)
      return companyUsers.map((user) => {
        const profile = profiles.find(p => p.userId.toString() === user._id.toString());
        
        if (profile) {
          return {
            id: profile._id.toString(),
            userId: profile.userId.toString(),
            companyName: profile.companyName,
            description: profile.description,
            industry: profile.industry,
            location: profile.location,
            logoUrl: profile.logoUrl,
            isVerified: profile.isVerified,
            website: profile.website,
            updatedAt: profile.updatedAt.toISOString(),
          };
        }

        // Return a "pending" profile for companies that haven't set one up yet
        return {
          id: user._id.toString(), // Use userId as temporary id
          userId: user._id.toString(),
          companyName: user.email.split('@')[0], // Fallback name
          description: "Бүртгэл дутуу",
          isVerified: false,
          updatedAt: user.createdAt.toISOString(),
        };
      }).filter(comp => !verifiedOnly || comp.isVerified);
    },
  },

  Mutation: {
    /**
     * Create company profile
     */
    createCompanyProfile: async (
      _: any,
      { input }: { input: CompanyProfileInput },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.COMPANY]);

      // Check if profile already exists
      const existingProfile = await CompanyProfile.findOne({
        userId: user.userId,
      });

      if (existingProfile) {
        throw new GraphQLError("Company profile already exists", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Create new profile (not verified by default)
      const profile = await CompanyProfile.create({
        userId: user.userId,
        ...input,
        isVerified: false,
        updatedAt: new Date(),
      });

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        companyName: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        location: profile.location,
        logoUrl: profile.logoUrl,
        isVerified: profile.isVerified,
        website: profile.website,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Update company profile
     */
    updateCompanyProfile: async (
      _: any,
      { input }: { input: CompanyProfileInput },
      context: Context,
    ) => {
      const user = requireRole(context, [UserRole.COMPANY]);

      // Find and update profile
      const profile = await CompanyProfile.findOneAndUpdate(
        { userId: user.userId },
        {
          ...input,
          updatedAt: new Date(),
        },
        { new: true, runValidators: true },
      );

      if (!profile) {
        throw new GraphQLError(
          "Company profile not found. Please create one first.",
          {
            extensions: { code: "NOT_FOUND" },
          },
        );
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        companyName: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        location: profile.location,
        logoUrl: profile.logoUrl,
        isVerified: profile.isVerified,
        website: profile.website,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },

    /**
     * Verify company (admin only)
     */
    verifyCompany: async (
      _: any,
      { companyProfileId }: { companyProfileId: string },
      context: Context,
    ) => {
      requireRole(context, [UserRole.ADMIN]);

      // 1. Try to find and update by profile ID
      let profile = await CompanyProfile.findByIdAndUpdate(
        companyProfileId,
        { isVerified: true, updatedAt: new Date() },
        { new: true },
      );

      // 2. If not found, check if companyProfileId is actually a user ID
      if (!profile) {
        const user = await User.findById(companyProfileId);
        if (user && user.role === UserRole.COMPANY) {
          // Check if profile exists for this user ID (maybe it has a different ID)
          profile = await CompanyProfile.findOneAndUpdate(
            { userId: user._id },
            { isVerified: true, updatedAt: new Date() },
            { new: true },
          );

          if (!profile) {
            // Create a skeleton profile
            profile = await CompanyProfile.create({
              userId: user._id,
              companyName: user.email.split("@")[0],
              isVerified: true,
              updatedAt: new Date(),
            });
          }
        }
      }

      if (!profile) {
        throw new GraphQLError("Company profile or user not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        companyName: profile.companyName,
        description: profile.description,
        industry: profile.industry,
        location: profile.location,
        logoUrl: profile.logoUrl,
        isVerified: profile.isVerified,
        website: profile.website,
        updatedAt: profile.updatedAt.toISOString(),
      };
    },
  },
};
