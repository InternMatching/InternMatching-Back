import { GraphQLError } from "graphql";
import Application from "./application.model.js";
import Job from "../job/job.model.js";
import StudentProfile from "../student-profile/studentProfile.model.js";
import CompanyProfile from "../company-profile/companyProfile.model.js";
import {
  Context,
  ApplicationStatus,
  UserRole
} from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { calculateMatchScore } from "../../utils/matchScore/index.js";
import {
  getOrComputeAIMatch,
  getOrComputeAIMatchBatch,
} from "../../utils/aiMatchScoreCached.js";
import { pushNotification } from "../../utils/pushNotification.js";
import { NotificationType } from "../../types/index.js";

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

      // Recompute live via the AI cache so a single-application fetch shows
      // the same number as the list views.
      let liveScore: number | null = null;
      try {
        const [student, job] = await Promise.all([
          StudentProfile.findById(application.studentProfileId),
          Job.findById(application.jobId),
        ]);
        if (student && job) {
          const result = await getOrComputeAIMatch(student as any, job as any);
          liveScore = result.score;
        }
      } catch (err) {
        console.warn("[getApplication] live score failed, using stored:", err);
      }

      return {
        ...application.toObject(),
        id: application._id.toString(),
        jobId: application.jobId.toString(),
        studentProfileId: application.studentProfileId.toString(),
        matchScore: liveScore ?? application.matchScore,
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

      // Restrict access
      const user = context.user!;
      if (user.role === UserRole.STUDENT) {
        const studentProfile = await StudentProfile.findOne({ userId: user.userId });
        if (!studentProfile) throw new GraphQLError("Profile not found");
        query.studentProfileId = studentProfile._id;
      } else if (user.role === UserRole.COMPANY) {
        const companyProfile = await CompanyProfile.findOne({ userId: user.userId });
        if (!companyProfile) throw new GraphQLError("Company profile not found");

        // If jobId is provided, verify it belongs to this company
        if (jobId) {
          const job = await Job.findById(jobId);
          if (!job || job.companyProfileId.toString() !== companyProfile._id.toString()) {
            throw new GraphQLError("Unauthorized access to this job's applications");
          }
          query.jobId = jobId;
        } else {
          // Otherwise, only show applications for jobs belonging to this company
          const companyJobs = await Job.find({ companyProfileId: companyProfile._id });
          const jobIds = companyJobs.map(job => job._id);
          query.jobId = { $in: jobIds };
        }
      }

      const applications = await Application.find(query);
      if (applications.length === 0) return [];

      // Recompute matchScore live via the AI cache so both the student's
      // "Миний хүсэлтүүд" page and the company's "Оюутнуудын хүсэлт" page
      // see the same number as the jobs list. Stale caches re-fire Claude;
      // fresh ones return instantly.
      const uniqueStudentIds = [
        ...new Set(applications.map((a) => a.studentProfileId.toString())),
      ];
      const uniqueJobIds = [
        ...new Set(applications.map((a) => a.jobId.toString())),
      ];
      const [studentDocs, jobDocs] = await Promise.all([
        StudentProfile.find({ _id: { $in: uniqueStudentIds } }),
        Job.find({ _id: { $in: uniqueJobIds } }),
      ]);
      const studentByApp = new Map(studentDocs.map((s) => [s._id.toString(), s]));
      const jobByApp = new Map(jobDocs.map((j) => [j._id.toString(), j]));

      // Group by student so we can use the batch helper (one cache lookup
      // per student instead of N).
      const grouped = new Map<string, { student: any; jobs: any[] }>();
      for (const app of applications) {
        const sid = app.studentProfileId.toString();
        const jid = app.jobId.toString();
        const student = studentByApp.get(sid);
        const job = jobByApp.get(jid);
        if (!student || !job) continue;
        let bucket = grouped.get(sid);
        if (!bucket) {
          bucket = { student, jobs: [] };
          grouped.set(sid, bucket);
        }
        if (!bucket.jobs.some((j) => j._id.toString() === jid)) {
          bucket.jobs.push(job);
        }
      }

      const scoreByPair = new Map<string, number | null>();
      await Promise.all(
        [...grouped.values()].map(async ({ student, jobs }) => {
          const results = await getOrComputeAIMatchBatch(student, jobs);
          for (const [jid, res] of results) {
            scoreByPair.set(`${student._id.toString()}::${jid}`, res ? res.score : null);
          }
        }),
      );

      const enriched = applications.map((app) => {
        const key = `${app.studentProfileId.toString()}::${app.jobId.toString()}`;
        const live = scoreByPair.get(key);
        // Fall back to stored value if AI scoring isn't available (no key,
        // missing student/job, etc.).
        const finalScore = typeof live === "number" ? live : app.matchScore;
        return {
          ...app.toObject(),
          id: app._id.toString(),
          jobId: app.jobId.toString(),
          studentProfileId: app.studentProfileId.toString(),
          matchScore: finalScore,
          appliedAt: app.appliedAt.toISOString(),
        };
      });

      enriched.sort((a, b) => {
        const diff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
        if (diff !== 0) return diff;
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      });

      return enriched;
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
        deadline: job.deadline?.toISOString(),
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

      // Calculate real match score
      const job = await Job.findById(jobId);
      if (!job) {
        throw new GraphQLError("Job not found", { extensions: { code: "NOT_FOUND" } });
      }

      const companyProfile = await CompanyProfile.findById(job.companyProfileId);

      // Use the shared AI cache so the stored score matches the one the
      // student saw on the jobs list. Fall back to the keyword formula if
      // Claude is unavailable so the apply flow never breaks.
      let matchScore: number;
      try {
        const aiResult = await getOrComputeAIMatch(studentProfile as any, job as any);
        matchScore = aiResult.score;
      } catch (err) {
        console.warn("[createApplication] AI score failed, falling back to keyword score:", err);
        matchScore = calculateMatchScore(
          studentProfile,
          job,
          coverLetter,
          "company",
          companyProfile?.industry,
        );
      }

      const application = await Application.create({
        jobId,
        studentProfileId: studentProfile._id,
        coverLetter,
        matchScore,
        status: ApplicationStatus.APPLIED,
        appliedAt: new Date(),
      });

      // Notify company that a student applied
      if (companyProfile) {
        const studentName = `${studentProfile.firstName ?? ""} ${studentProfile.lastName ?? ""}`.trim() || "Оюутан";
        pushNotification({
          userId: companyProfile.userId.toString(),
          type: NotificationType.APPLICATION_RECEIVED,
          title: "Шинэ өргөдөл ирлээ",
          message: `${studentName} "${job.title}" ажилд өргөдөл гаргалаа.`,
          data: { applicationId: application._id.toString(), jobId: job._id.toString(), jobTitle: job.title },
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

      // Notify student of status change
      const studentProfile = await StudentProfile.findById(updatedApp!.studentProfileId);
      if (studentProfile) {
        const job = await Job.findById(updatedApp!.jobId);
        const statusLabels: Record<string, string> = {
          reviewing: "Хянагдаж байна",
          interview_scheduled: "Ярилцлагад урьсан",
          accepted: "Хүлээн авлаа",
          rejected: "Татгалзлаа",
        };
        const label = statusLabels[status] ?? status;
        pushNotification({
          userId: studentProfile.userId.toString(),
          type: NotificationType.APPLICATION_STATUS_CHANGED,
          title: "Өргөдлийн статус өөрчлөгдлөө",
          message: `"${job?.title ?? "Ажлын байр"}" өргөдлийн статус: ${label}`,
          data: { applicationId: updatedApp!._id.toString(), status, jobTitle: job?.title ?? "" },
        });
      }

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
