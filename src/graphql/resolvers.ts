import { authResolvers } from "../modules/auth/auth.resolvers.js";
import { studentProfileResolvers } from "../modules/student-profile/studentProfile.resolvers.js";
import { companyProfileResolvers } from "../modules/company-profile/companyProfile.resolvers.js";
import { jobResolvers } from "../modules/job/job.resolvers.js";
import { applicationResolvers } from "../modules/application/application.resolvers.js";
import { invitationResolvers } from "../modules/invitation/invitation.resolvers.js";
import { adminResolvers } from "../modules/admin/admin.resolvers.js";

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...studentProfileResolvers.Query,
    ...companyProfileResolvers.Query,
    ...jobResolvers.Query,
    ...applicationResolvers.Query,
    ...invitationResolvers.Query,
    ...adminResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...studentProfileResolvers.Mutation,
    ...companyProfileResolvers.Mutation,
    ...jobResolvers.Mutation,
    ...applicationResolvers.Mutation,
    ...invitationResolvers.Mutation,
    ...adminResolvers.Mutation,
  },
  StudentProfile: studentProfileResolvers.StudentProfile,
  Job: jobResolvers.Job,
  Application: applicationResolvers.Application,
  Invitation: invitationResolvers.Invitation,
};
