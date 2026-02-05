import { GraphQLError } from "graphql";
import { Application, Job, StudentProfile, CompanyProfile } from "../../models/index.js";
import { 
  Context, 
  ApplicationStatus, 
  UserRole 
} from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const applicationResolvers = {
  Query: {
    getApplication: async (_: any, { id }: { id: string }, context: Context) => {
      requireAuth(context);
      const application = await Application.findById(id);
      if (!application) {
        throw new GraphQLError("Application not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return {
        ...application.toObject(),
        id: application._id.toString(),
        jobId: application.jobId.toString(),
        studentProfileId: application.studentProfileId.toString(),
        appliedAt: application.appliedAt.toISOString(),
      };
    },

    getAllApplications: async (
      _: any,
      { jobId, studentProfileId }: { jobId?: string; studentProfileId?: string },
      context: Context
    ) => {
      requireAuth(context);
      const query: any = {};
      if (jobId) query.jobId = jobId;
      if (studentProfileId) query.studentProfileId = studentProfileId;

      // Restrict access for non-admins
      const user = context.user!;
      if (user.role === UserRole.STUDENT) {
        const studentProfile = await StudentProfile.findOne({ userId: user.userId });
        if (!studentProfile) throw new GraphQLError("Profile not found");
        query.studentProfileId = studentProfile._id;
      }

      const applications = await Application.find(query).sort({ appliedAt: -1 });
      return applications.map((app) => ({
        ...app.toObject(),
        id: app._id.toString(),
        jobId: app.jobId.toString(),
        studentProfileId: app.studentProfileId.toString(),
        appliedAt: app.appliedAt.toISOString(),
      }));
    },
  },

  Application: {
    job: async (parent: any) => {
      const job = await Job.findById(parent.jobId);
      if (!job) return null;
      return {
        ...job.toObject(),
        id: job._id.toString(),
        companyProfileId: job.companyProfileId.toString(),
        postedAt: job.postedAt.toISOString(),
      };
    },
    student: async (parent: any) => {
      const profile = await StudentProfile.findById(parent.studentProfileId);
      if (!profile) return null;
      return {
        ...profile.toObject(),
        id: profile._id.toString(),
        userId: profile.userId.toString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    },
  },

  Mutation: {
    createApplication: async (
      _: any,
      { jobId, coverLetter }: { jobId: string; coverLetter?: string },
      context: Context
    ) => {
      const user = requireRole(context, [UserRole.STUDENT]);
      
      const studentProfile = await StudentProfile.findOne({ userId: user.userId });
      if (!studentProfile) {
        throw new GraphQLError("Student profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Check for existing application
      const existing = await Application.findOne({ jobId, studentProfileId: studentProfile._id });
      if (existing) {
        throw new GraphQLError("You have already applied for this job", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Simple match score mock (0-100)
      const matchScore = Math.floor(Math.random() * 101);

      const application = await Application.create({
        jobId,
        studentProfileId: studentProfile._id,
        coverLetter,
        matchScore,
        status: ApplicationStatus.APPLIED,
        appliedAt: new Date(),
      });

      return {
        ...application.toObject(),
        id: application._id.toString(),
        jobId: application.jobId.toString(),
        studentProfileId: application.studentProfileId.toString(),
        appliedAt: application.appliedAt.toISOString(),
      };
    },

    updateApplicationStatus: async (
      _: any,
      { id, status }: { id: string; status: ApplicationStatus },
      context: Context
    ) => {
      const user = requireRole(context, [UserRole.COMPANY, UserRole.ADMIN]);
      
      const application = await Application.findById(id);
      if (!application) {
        throw new GraphQLError("Application not found", { extensions: { code: "NOT_FOUND" } });
      }

      if (user.role === UserRole.COMPANY) {
        const job = await Job.findById(application.jobId);
        const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
        if (!job || !companyProfile || job.companyProfileId.toString() !== companyProfile._id.toString()) {
          throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
        }
      }

      const updatedApp = await Application.findByIdAndUpdate(id, { status }, { new: true });
      return {
        ...updatedApp!.toObject(),
        id: updatedApp!._id.toString(),
        jobId: updatedApp!.jobId.toString(),
        studentProfileId: updatedApp!.studentProfileId.toString(),
        appliedAt: updatedApp!.appliedAt.toISOString(),
      };
    },
  },
};
