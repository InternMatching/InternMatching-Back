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

  enum ApplicationStatus {
    applied
    reviewing
    interview_scheduled
    accepted
    rejected
  }

  enum JobStatus {
    open
    closed
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

  type Job {
    id: ID!
    companyProfileId: ID!
    company: CompanyProfile
    title: String!
    description: String
    type: ExperienceLevel!
    requiredSkills: [String!]!
    location: String
    salaryRange: String
    status: JobStatus!
    postedAt: String!
  }

  type Application {
    id: ID!
    jobId: ID!
    job: Job
    studentProfileId: ID!
    student: StudentProfile
    status: ApplicationStatus!
    matchScore: Float!
    coverLetter: String
    appliedAt: String!
  }

  type AdminStats {
    totalUsers: Int!
    totalStudents: Int!
    totalCompanies: Int!
    activeJobs: Int!
    totalApplications: Int!
    pendingVerifications: Int!
    newUsersToday: Int!
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

  input JobInput {
    title: String!
    description: String
    type: ExperienceLevel!
    requiredSkills: [String!]
    location: String
    salaryRange: String
    status: JobStatus
  }

  # Queries
  type Query {
    # Auth & User
    me: User
    getUser(id: ID!): User
    getAllUsers: [User!]!

    # Student Profile
    getStudentProfile(userId: ID): StudentProfile
    getAllStudentProfiles: [StudentProfile!]!

    # Company Profile
    getCompanyProfile(userId: ID): CompanyProfile
    getAllCompanyProfiles(verifiedOnly: Boolean): [CompanyProfile!]!

    # Jobs
    getJob(id: ID!): Job
    getAllJobs(companyProfileId: ID, status: JobStatus): [Job!]!

    # Applications
    getApplication(id: ID!): Application
    getAllApplications(jobId: ID, studentProfileId: ID): [Application!]!

    # Admin
    adminStats: AdminStats!
  }

  # Mutations
  type Mutation {
    # Authentication
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    # User Management
    deleteUser(userId: ID!): Boolean!

    # Student Profile
    createStudentProfile(input: StudentProfileInput!): StudentProfile!
    updateStudentProfile(input: StudentProfileInput!): StudentProfile!

    # Company Profile
    createCompanyProfile(input: CompanyProfileInput!): CompanyProfile!
    updateCompanyProfile(input: CompanyProfileInput!): CompanyProfile!

    # Jobs
    createJob(input: JobInput!): Job!
    updateJob(id: ID!, input: JobInput!): Job!
    deleteJob(id: ID!): Boolean!

    # Applications
    createApplication(jobId: ID!, coverLetter: String): Application!
    updateApplicationStatus(id: ID!, status: ApplicationStatus!): Application!

    # Admin only
    verifyCompany(companyProfileId: ID!): CompanyProfile!

    # Password Reset
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
  }
`;
