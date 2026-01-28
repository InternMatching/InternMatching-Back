import { gql } from "apollo-server";

export const typeDefs = gql`
  # Enums
  enum UserRole {
    student
    company
    admin
  }

  enum ExperienceLevel {
    intern
    junior
  }

  # Types
  type User {
    id: ID!
    email: String!
    role: UserRole!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type StudentProfile {
    id: ID!
    userId: ID!
    firstName: String
    lastName: String
    skills: [String!]!
    cvUrl: String
    bio: String
    experienceLevel: ExperienceLevel
    education: [Education!]
    updatedAt: String!
  }

  type Education {
    school: String!
    degree: String!
    year: Int!
  }

  type CompanyProfile {
    id: ID!
    userId: ID!
    companyName: String!
    description: String
    industry: String
    location: String
    logoUrl: String
    isVerified: Boolean!
    website: String
    updatedAt: String!
  }

  # Input Types
  input SignupInput {
    email: String!
    password: String!
    role: UserRole!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input StudentProfileInput {
    firstName: String
    lastName: String
    skills: [String!]
    cvUrl: String
    bio: String
    experienceLevel: ExperienceLevel
    education: [EducationInput!]
  }

  input EducationInput {
    school: String!
    degree: String!
    year: Int!
  }

  input CompanyProfileInput {
    companyName: String!
    description: String
    industry: String
    location: String
    logoUrl: String
    website: String
  }

  # Queries
  type Query {
    # Auth & User
    me: User
    getUser(id: ID!): User

    # Student Profile
    getStudentProfile(userId: ID): StudentProfile
    getAllStudentProfiles: [StudentProfile!]!

    # Company Profile
    getCompanyProfile(userId: ID): CompanyProfile
    getAllCompanyProfiles(verifiedOnly: Boolean): [CompanyProfile!]!
  }

  # Mutations
  type Mutation {
    # Authentication
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    # Student Profile
    createStudentProfile(input: StudentProfileInput!): StudentProfile!
    updateStudentProfile(input: StudentProfileInput!): StudentProfile!

    # Company Profile
    createCompanyProfile(input: CompanyProfileInput!): CompanyProfile!
    updateCompanyProfile(input: CompanyProfileInput!): CompanyProfile!

    # Admin only
    verifyCompany(companyProfileId: ID!): CompanyProfile!
  }
`;
