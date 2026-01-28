import CompanyProfile from "../../models/CompanyProfile.js";
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

      const query = verifiedOnly ? { isVerified: true } : {};
      const profiles = await CompanyProfile.find(query);

      return profiles.map((profile: any) => ({
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
      }));
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

      const profile = await CompanyProfile.findByIdAndUpdate(
        companyProfileId,
        { isVerified: true, updatedAt: new Date() },
        { new: true },
      );

      if (!profile) {
        throw new GraphQLError("Company profile not found", {
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
