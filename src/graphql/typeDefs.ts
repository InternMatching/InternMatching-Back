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
  }

  enum ApplicationStatus {
    applied
    reviewing
    interview_scheduled
    accepted
    rejected
  }

  enum InvitationStatus {
    pending
    accepted
    rejected
  }

  enum JobStatus {
    open
    closed
  }

  enum StatsPeriod {
    DAILY
    WEEKLY
  }

  # Types
  type User {
    id: ID!
    email: String!
    role: String!
    phoneNumber: String
    themeColor: String
    emailNotifications: Boolean
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type StudentProfile {
    id: ID!
    userId: ID!
    user: User
    firstName: String
    lastName: String
    skills: [String!]!
    cvUrl: String
    profilePictureUrl: String
    bio: String
    experienceLevel: ExperienceLevel
    isActivelyLooking: Boolean
    education: [Education!]
    updatedAt: String!
  }

  type Education {
    school: String!
    degree: String!
    year: Int!
    status: String
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
    foundedYear: Int
    employeeCount: Int
    slogan: String
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
    responsibilities: String
    requirements: String
    additionalInfo: String
    deadline: String
    maxParticipants: Int
    applicationCount: Int!
    status: JobStatus!
    postedAt: String!
    matchScore: Float
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

  type Invitation {
    id: ID!
    companyProfileId: ID!
    company: CompanyProfile
    studentProfileId: ID!
    student: StudentProfile
    message: String
    status: InvitationStatus!
    sentAt: String!
    respondedAt: String
  }

  type GrowthData {
    name: String!
    users: Int!
    apps: Int!
  }

  type RecentActivity {
    id: ID!
    user: String!
    action: String!
    timestamp: String!
    type: String!
  }

  type AdminStats {
    totalUsers: Int!
    totalStudents: Int!
    totalCompanies: Int!
    activeJobs: Int!
    totalApplications: Int!
    pendingVerifications: Int!
    newUsersToday: Int!
    growthData: [GrowthData!]!
    recentActivities: [RecentActivity!]!
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

  input SocialLoginInput {
    email: String!
    socialId: String!
    provider: String!
    role: UserRole
    firstName: String
    lastName: String
    profilePictureUrl: String
  }

  input StudentProfileInput {
    firstName: String
    lastName: String
    skills: [String!]
    cvUrl: String
    profilePictureUrl: String
    bio: String
    experienceLevel: ExperienceLevel
    isActivelyLooking: Boolean
    education: [EducationInput!]
  }

  input EducationInput {
    school: String!
    degree: String!
    year: Int!
    status: String
  }

  input CompanyProfileInput {
    companyName: String!
    description: String
    industry: String
    location: String
    logoUrl: String
    website: String
    foundedYear: Int
    employeeCount: Int
    slogan: String
  }

  input JobInput {
    title: String!
    description: String
    type: ExperienceLevel!
    requiredSkills: [String!]
    location: String
    salaryRange: String
    responsibilities: String
    requirements: String
    additionalInfo: String
    deadline: String
    maxParticipants: Int
    status: JobStatus
  }

  input UpdateSettingsInput {
    email: String
    phoneNumber: String
    themeColor: String
    emailNotifications: Boolean
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

    # Invitations
    getInvitations(companyProfileId: ID, studentProfileId: ID): [Invitation!]!

    # Admin
    adminStats(period: StatsPeriod): AdminStats!
  }

  # Mutations
  type Mutation {
    # Authentication
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    socialLogin(input: SocialLoginInput!): AuthPayload!
    githubLogin(code: String!, role: UserRole): AuthPayload!

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

    # Invitations
    sendInvitation(studentProfileId: ID!, message: String): Invitation!
    respondToInvitation(id: ID!, status: InvitationStatus!): Invitation!

    # Admin only
    verifyCompany(companyProfileId: ID!): CompanyProfile!
    updateSettings(input: UpdateSettingsInput!): User!
    uploadCompanyLogo(base64Image: String!): CompanyProfile!
    uploadStudentProfilePicture(base64Image: String!): StudentProfile!

    # Password Reset
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
  }
`;
