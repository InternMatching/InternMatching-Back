import { Types } from "mongoose";

// User roles
export enum UserRole {
  STUDENT = "student",
  COMPANY = "company",
  ADMIN = "admin",
}

// Experience levels
export enum ExperienceLevel {
  INTERN = "intern",
  JUNIOR = "junior",
}

// Application status
export enum ApplicationStatus {
  APPLIED = "applied",
  REVIEWING = "reviewing",
  INTERVIEW_SCHEDULED = "interview_scheduled",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

// Job status
export enum JobStatus {
  OPEN = "open",
  CLOSED = "closed",
}

// User interface
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Student Profile interface
export interface IStudentProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  skills: string[];
  cvUrl?: string;
  bio?: string;
  experienceLevel?: ExperienceLevel;
  education?: {
    school: string;
    degree: string;
    year: number;
  }[];
  updatedAt: Date;
}

// Company Profile interface
export interface ICompanyProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  companyName: string;
  description?: string;
  industry?: string;
  location?: string;
  logoUrl?: string;
  isVerified: boolean;
  website?: string;
  updatedAt: Date;
}

// Job interface
export interface IJob {
  _id: Types.ObjectId;
  companyProfileId: Types.ObjectId;
  title: string;
  description?: string;
  type: ExperienceLevel;
  requiredSkills: string[];
  location?: string;
  salaryRange?: string;
  status: JobStatus;
  postedAt: Date;
}

// Application interface
export interface IApplication {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  studentProfileId: Types.ObjectId;
  status: ApplicationStatus;
  matchScore: number;
  coverLetter?: string;
  appliedAt: Date;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// GraphQL Context
export interface Context {
  user?: JWTPayload | undefined;
  req: Request;
}

// Auth Response
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt?: string;
  };
}
