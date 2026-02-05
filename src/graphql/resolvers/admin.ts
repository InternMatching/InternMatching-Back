import { GraphQLError } from "graphql";
import { User, StudentProfile, CompanyProfile, Job, Application } from "../../models/index.js";
import { Context, UserRole } from "../../types/index.js";
import { requireRole } from "../../middleware/auth.js";

export const adminResolvers = {
  Query: {
    getAllUsers: async (_: any, __: any, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);
      const users = await User.find().sort({ createdAt: -1 });
      return users.map(user => ({
        ...user.toObject(),
        id: user._id.toString(),
        createdAt: user.createdAt.toISOString()
      }));
    },

    adminStats: async (_: any, __: any, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);

      const [
        totalUsers,
        totalStudents,
        totalCompanies,
        activeJobs,
        totalApplications,
        pendingVerifications,
        newUsersToday
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: UserRole.STUDENT }),
        User.countDocuments({ role: UserRole.COMPANY }),
        Job.countDocuments({ status: "open" }),
        Application.countDocuments(),
        CompanyProfile.countDocuments({ isVerified: false }),
        User.countDocuments({ 
          createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } 
        })
      ]);

      return {
        totalUsers,
        totalStudents,
        totalCompanies,
        activeJobs,
        totalApplications,
        pendingVerifications,
        newUsersToday
      };
    }
  },

  Mutation: {
    deleteUser: async (_: any, { userId }: { userId: string }, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);

      const user = await User.findById(userId);
      if (!user) {
        throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      }

      // 1. Delete profiles
      if (user.role === UserRole.STUDENT) {
        const profile = await StudentProfile.findOne({ userId });
        if (profile) {
          await Application.deleteMany({ studentProfileId: profile._id });
          await StudentProfile.deleteOne({ _id: profile._id });
        }
      } else if (user.role === UserRole.COMPANY) {
        const profile = await CompanyProfile.findOne({ userId });
        if (profile) {
          const jobs = await Job.find({ companyProfileId: profile._id });
          const jobIds = jobs.map(j => j._id);
          await Application.deleteMany({ jobId: { $in: jobIds } });
          await Job.deleteMany({ companyProfileId: profile._id });
          await CompanyProfile.deleteOne({ _id: profile._id });
        }
      }

      // 2. Delete user
      await User.deleteOne({ _id: userId });
      return true;
    }
  }
};
