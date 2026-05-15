import { GraphQLError } from "graphql";
import Job from "./job.model.js";
import CompanyProfile from "../company-profile/companyProfile.model.js";
import Application from "../application/application.model.js";
import StudentProfile from "../student-profile/studentProfile.model.js";
import {
  Context,
  JobStatus,
  ExperienceLevel,
  UserRole
} from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { calculateMatchScore } from "../../utils/matchScore/index.js";
import { getAIMatchScore } from "../../utils/aiMatchScore.js";
import { pushNotification } from "../../utils/pushNotification.js";
import { NotificationType } from "../../types/index.js";

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
    getAIMatchScore: async (
      _: any,
      { jobId }: { jobId: string },
      context: Context,
    ) => {
      requireRole(context, [UserRole.STUDENT]);

      const [job, studentProfile] = await Promise.all([
        Job.findById(jobId),
        StudentProfile.findOne({ userId: context.user!.userId }),
      ]);

      if (!job) {
        throw new GraphQLError("Job not found", { extensions: { code: "NOT_FOUND" } });
      }
      if (!studentProfile) {
        throw new GraphQLError("Профайл олдсонгүй. Эхлээд профайлаа бүрэн бөглөнө үү.", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const today = new Date();
      const aiMatchDate = studentProfile.aiMatchDate;
      const isSameDay =
        aiMatchDate &&
        aiMatchDate.getFullYear() === today.getFullYear() &&
        aiMatchDate.getMonth() === today.getMonth() &&
        aiMatchDate.getDate() === today.getDate();

      const aiMatchCount = isSameDay ? (studentProfile.aiMatchCount ?? 0) : 0;

      if (aiMatchCount >= 1) {
        throw new GraphQLError(
          "Өнөөдрийн AI шинжилгээний хязгаарт хүрлээ. Маргааш дахин оролдоно уу.",
          { extensions: { code: "AI_MATCH_LIMIT_EXCEEDED" } },
        );
      }

      await StudentProfile.updateOne(
        { userId: context.user!.userId },
        {
          $set: {
            aiMatchCount: aiMatchCount + 1,
            aiMatchDate: isSameDay ? aiMatchDate : today,
          },
        },
      );

      return getAIMatchScore(studentProfile, job);
    },

    getJob: async (_: any, { id }: { id: string }, context: Context) => {
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

      const jobs = await Job.find(query).sort({ postedAt: -1 }).lean();

      if (jobs.length === 0) return [];

      // Batch-load all company profiles in ONE query (fixes N+1)
      const companyIds = [...new Set(jobs.map((j) => j.companyProfileId.toString()))];
      const companies = await CompanyProfile.find({ _id: { $in: companyIds } })
        .select("companyName description industry logoUrl location foundedYear employeeCount slogan website")
        .lean();
      const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

      // Batch-load all application counts in ONE aggregation (fixes N+1)
      const jobIds = jobs.map((j) => j._id);
      const counts = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        { $group: { _id: "$jobId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

      return jobs.map((job) => {
        const company = companyMap.get(job.companyProfileId.toString()) || null;
        return {
          ...job,
          id: job._id.toString(),
          companyProfileId: job.companyProfileId.toString(),
          deadline: job.deadline?.toISOString(),
          postedAt: job.postedAt?.toISOString(),
          applicationCount: countMap.get(job._id.toString()) || 0,
          company: company
            ? {
                ...company,
                id: company._id.toString(),
                userId: company.userId?.toString(),
              }
            : null,
        };
      });
    },
  },

  Job: {
    company: async (parent: any) => {
      // Use pre-loaded data from getAllJobs batch query
      if (parent.company) return parent.company;
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
      // Use pre-loaded count from getAllJobs batch query
      if (parent.applicationCount !== undefined) return parent.applicationCount;
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

      if (!input.title?.trim()) {
        throw new GraphQLError("Title is required", { extensions: { code: "BAD_USER_INPUT" } });
      }
      if (!input.type) {
        throw new GraphQLError("Type is required", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
      if (!companyProfile) {
        throw new GraphQLError("Company profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const isDraft = input.status === JobStatus.DRAFT;
      if (!companyProfile.isVerified && !isDraft) {
        throw new GraphQLError("Company must be verified to post jobs", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const job = await Job.create({
        ...input,
        status: isDraft ? JobStatus.DRAFT : JobStatus.OPEN,
        companyProfileId: companyProfile._id,
        postedAt: new Date(),
      });

      // Notify actively-looking students with at least 1 matching skill (max 100)
      if (!isDraft && Array.isArray(input.requiredSkills) && input.requiredSkills.length > 0) {
        const skillsLower = input.requiredSkills.map((s: string) => s.toLowerCase());
        StudentProfile.find({ isActivelyLooking: true })
          .select("userId skills")
          .limit(500)
          .then((students) => {
            const matched = students.filter((s) =>
              s.skills.some((sk) => skillsLower.includes(sk.toLowerCase()))
            ).slice(0, 100);
            matched.forEach((s) => {
              pushNotification({
                userId: s.userId.toString(),
                type: NotificationType.NEW_JOB_POSTED,
                title: "Таны чиглэлийн шинэ ажлын байр",
                message: `${companyProfile.companyName}: "${job.title}" нээлттэй боллоо.`,
                data: { jobId: job._id.toString(), jobTitle: job.title, companyName: companyProfile.companyName },
              });
            });
          })
          .catch((err) => console.error("[job notify students]", err));
      }

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

    adminCreateJob: async (
      _: any,
      { companyProfileId, input }: { companyProfileId: string; input: JobInput },
      context: Context
    ) => {
      requireRole(context, [UserRole.ADMIN]);

      if (!input.title?.trim()) {
        throw new GraphQLError("Title is required", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const companyProfile = await CompanyProfile.findById(companyProfileId);
      if (!companyProfile) {
        throw new GraphQLError("Company profile not found", { extensions: { code: "NOT_FOUND" } });
      }

      const job = await Job.create({
        ...input,
        type: input.type || ExperienceLevel.INTERN,
        status: input.status || JobStatus.OPEN,
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
