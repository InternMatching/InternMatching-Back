import { authResolvers } from "./auth.js";
import { studentProfileResolvers } from "./studentProfile.js";
import { companyProfileResolvers } from "./companyProfile.js";

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...studentProfileResolvers.Query,
    ...companyProfileResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...studentProfileResolvers.Mutation,
    ...companyProfileResolvers.Mutation,
  },
};
