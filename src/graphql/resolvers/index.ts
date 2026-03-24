import { authResolvers } from "./auth.js";
import { studentProfileResolvers } from "./studentProfile.js";
import { companyProfileResolvers } from "./companyProfile.js";
import { jobResolvers } from "./job.js";
import { applicationResolvers } from "./application.js";
import { invitationResolvers } from "./invitation.js";
import { adminResolvers } from "./admin.js";

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
