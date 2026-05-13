import { GraphQLError } from "graphql";
import Invitation from "./invitation.model.js";
import StudentProfile from "../student-profile/studentProfile.model.js";
import CompanyProfile from "../company-profile/companyProfile.model.js";
import Application from "../application/application.model.js";
import Job from "../job/job.model.js";
import {
  ApplicationStatus,
  Context,
  InvitationStatus,
  UserRole,
} from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";

export const invitationResolvers = {
  Query: {
    getInvitations: async (
      _: any,
      { companyProfileId, studentProfileId }: { companyProfileId?: string; studentProfileId?: string },
      context: Context
    ) => {
      requireAuth(context);
      const query: any = {};
      if (companyProfileId) query.companyProfileId = companyProfileId;
      if (studentProfileId) query.studentProfileId = studentProfileId;

      const role = context.user!.role;

      if (role === UserRole.STUDENT) {
        const studentProfile = await StudentProfile.findOne({ userId: context.user!.userId });
        if (!studentProfile) {
          throw new GraphQLError("Student profile not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        query.studentProfileId = studentProfile._id;
      } else if (role === UserRole.COMPANY) {
        const companyProfile = await CompanyProfile.findOne({ userId: context.user!.userId });
        if (!companyProfile) {
          throw new GraphQLError("Company profile not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        query.companyProfileId = companyProfile._id;
      }

      const invitations = await Invitation.find(query).sort({ sentAt: -1 });

      return invitations.map((inv) => ({
        ...inv.toObject(),
        id: inv._id.toString(),
        companyProfileId: inv.companyProfileId.toString(),
        studentProfileId: inv.studentProfileId.toString(),
        sentAt: inv.sentAt.toISOString(),
        respondedAt: inv.respondedAt?.toISOString() || null,
      }));
    },
  },

  Mutation: {
    sendInvitation: async (
      _: any,
      { studentProfileId, message }: { studentProfileId: string; message?: string },
      context: Context
    ) => {
      requireAuth(context);

      if (context.user!.role !== UserRole.COMPANY) {
        throw new GraphQLError("Only companies can send invitations", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const companyProfile = await CompanyProfile.findOne({ userId: context.user!.userId });
      if (!companyProfile) {
        throw new GraphQLError("Company profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const student = await StudentProfile.findById(studentProfileId);
      if (!student) {
        throw new GraphQLError("Student not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const existing = await Invitation.findOne({
        companyProfileId: companyProfile._id,
        studentProfileId: studentProfileId,
        status: InvitationStatus.PENDING,
      });

      if (existing) {
        throw new GraphQLError("Invitation already sent to this student", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      const invitation = await Invitation.create({
        companyProfileId: companyProfile._id,
        studentProfileId: studentProfileId,
        message: message || null,
        status: InvitationStatus.PENDING,
        sentAt: new Date(),
      });

      // Auto-approve any pending applications this student has for jobs from this company
      const companyJobs = await Job.find({ companyProfileId: companyProfile._id }).select("_id");
      if (companyJobs.length > 0) {
        const jobIds = companyJobs.map((j) => j._id);
        await Application.updateMany(
          {
            studentProfileId: studentProfileId,
            jobId: { $in: jobIds },
            status: { $nin: [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED] },
          },
          { status: ApplicationStatus.ACCEPTED }
        );
      }

      return {
        ...invitation.toObject(),
        id: invitation._id.toString(),
        companyProfileId: invitation.companyProfileId.toString(),
        studentProfileId: invitation.studentProfileId.toString(),
        sentAt: invitation.sentAt.toISOString(),
        respondedAt: null,
      };
    },

    respondToInvitation: async (
      _: any,
      { id, status }: { id: string; status: InvitationStatus },
      context: Context
    ) => {
      requireAuth(context);

      if (context.user!.role !== UserRole.STUDENT) {
        throw new GraphQLError("Only students can respond to invitations", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const invitation = await Invitation.findById(id);
      if (!invitation) {
        throw new GraphQLError("Invitation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const studentProfile = await StudentProfile.findOne({ userId: context.user!.userId });
      if (!studentProfile || invitation.studentProfileId.toString() !== studentProfile._id.toString()) {
        throw new GraphQLError("Not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new GraphQLError("Invitation has already been responded to", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      if (status !== InvitationStatus.ACCEPTED && status !== InvitationStatus.REJECTED) {
        throw new GraphQLError("Invalid status. Must be 'accepted' or 'rejected'", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      invitation.status = status;
      invitation.respondedAt = new Date();
      await invitation.save();

      return {
        ...invitation.toObject(),
        id: invitation._id.toString(),
        companyProfileId: invitation.companyProfileId.toString(),
        studentProfileId: invitation.studentProfileId.toString(),
        sentAt: invitation.sentAt.toISOString(),
        respondedAt: invitation.respondedAt.toISOString(),
      };
    },
  },

  Invitation: {
    company: async (parent: any) => {
      const company = await CompanyProfile.findById(parent.companyProfileId);
      if (!company) return null;
      return {
        ...company.toObject(),
        id: company._id.toString(),
        userId: company.userId.toString(),
        updatedAt: company.updatedAt.toISOString(),
      };
    },
    student: async (parent: any) => {
      const student = await StudentProfile.findById(parent.studentProfileId);
      if (!student) return null;
      return {
        ...student.toObject(),
        id: student._id.toString(),
        userId: student.userId.toString(),
        updatedAt: student.updatedAt.toISOString(),
      };
    },
  },
};
