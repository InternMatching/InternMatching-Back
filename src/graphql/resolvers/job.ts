import { GraphQLError } from "graphql";
import { Job, CompanyProfile, Application, StudentProfile } from "../../models/index.js";
import {
  Context,
  JobStatus,
  ExperienceLevel,
  UserRole
} from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { calculateMatchScore } from "../../utils/matchScore.js";

interface JobInput {
  title: string;
  description?: string;
  type: ExperienceLevel;
  requiredSkills?: string[];
  location?: string;
  salaryRange?: string;
  responsibilities?: string;
  requirements?: string;
  additionalInfo?: string;
  deadline?: string;
  maxParticipants?: number;
  status?: JobStatus;
}

export const jobResolvers = {
  Query: {
    getJob: async (_: any, { id }: { id: string }, context: Context) => {
      requireAuth(context);
      const job = await Job.findById(id);
      if (!job) {
        throw new GraphQLError("Job not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return {
        ...job.toObject(),
        id: job._id.toString(),
        companyProfileId: job.companyProfileId.toString(),
        deadline: job.deadline?.toISOString(),
        postedAt: job.postedAt.toISOString(),
      };
    },

    getAllJobs: async (
      _: any,
      { companyProfileId, status }: { companyProfileId?: string; status?: JobStatus },
      context: Context
    ) => {
      const query: any = {};
      if (companyProfileId) query.companyProfileId = companyProfileId;
      if (status) query.status = status;

      const jobs = await Job.find(query).sort({ postedAt: -1 });
      return jobs.map((job) => ({
        ...job.toObject(),
        id: job._id.toString(),
        companyProfileId: job.companyProfileId.toString(),
        deadline: job.deadline?.toISOString(),
        postedAt: job.postedAt.toISOString(),
      }));
    },
  },

  Job: {
    company: async (parent: any) => {
      const profile = await CompanyProfile.findById(parent.companyProfileId);
      if (!profile) return null;
      return {
        ...profile.toObject(),
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    },
    applicationCount: async (parent: any) => {
      return Application.countDocuments({ jobId: parent._id ?? parent.id });
    },
    matchScore: async (parent: any, _: any, context: Context) => {
      // Only compute for logged-in students
      if (!context.user || context.user.role !== UserRole.STUDENT) return null;

      // Cache student profile on context to avoid N+1 queries
      if (!context._cachedStudentProfile) {
        context._cachedStudentProfile = await StudentProfile.findOne({ userId: context.user.userId });
      }
      const studentProfile = context._cachedStudentProfile;
      if (!studentProfile) return null;

      return calculateMatchScore(studentProfile, parent, undefined, "student");
    },
  },

  Mutation: {
    createJob: async (_: any, { input }: { input: JobInput }, context: Context) => {
      const user = requireRole(context, [UserRole.COMPANY]);
      
      const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
      if (!companyProfile) {
        throw new GraphQLError("Company profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      if (!companyProfile.isVerified) {
        throw new GraphQLError("Company must be verified to post jobs", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const job = await Job.create({
        ...input,
        companyProfileId: companyProfile._id,
        postedAt: new Date(),
      });

      return {
        ...job.toObject(),
        id: job._id.toString(),
        companyProfileId: job.companyProfileId.toString(),
        deadline: job.deadline?.toISOString(),
        postedAt: job.postedAt.toISOString(),
      };
    },

    updateJob: async (
      _: any,
      { id, input }: { id: string; input: JobInput },
      context: Context
    ) => {
      const user = requireRole(context, [UserRole.COMPANY, UserRole.ADMIN]);
      
      const job = await Job.findById(id);
      if (!job) {
        throw new GraphQLError("Job not found", { extensions: { code: "NOT_FOUND" } });
      }

      if (user.role === UserRole.COMPANY) {
        const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
        if (!companyProfile || job.companyProfileId.toString() !== companyProfile._id.toString()) {
          throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
        }
      }

      const updatedJob = await Job.findByIdAndUpdate(id, { ...input }, { new: true });
      return {
        ...updatedJob!.toObject(),
        id: updatedJob!._id.toString(),
        companyProfileId: updatedJob!.companyProfileId.toString(),
        deadline: updatedJob!.deadline?.toISOString(),
        postedAt: updatedJob!.postedAt.toISOString(),
      };
    },

    deleteJob: async (_: any, { id }: { id: string }, context: Context) => {
      const user = requireRole(context, [UserRole.COMPANY, UserRole.ADMIN]);
      
      const job = await Job.findById(id);
      if (!job) {
        throw new GraphQLError("Job not found", { extensions: { code: "NOT_FOUND" } });
      }

      if (user.role === UserRole.COMPANY) {
        const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
        if (!companyProfile || job.companyProfileId.toString() !== companyProfile._id.toString()) {
          throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
        }
      }

      await Job.findByIdAndDelete(id);
      return true;
    },
  },
};
