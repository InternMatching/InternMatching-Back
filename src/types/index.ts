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
}

// Application status
export enum ApplicationStatus {
  APPLIED = "applied",
  REVIEWING = "reviewing",
  INTERVIEW_SCHEDULED = "interview_scheduled",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

// Invitation status
export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

// Job status
export enum JobStatus {
  OPEN = "open",
  CLOSED = "closed",
  DRAFT = "draft",
}

// Stats period
export enum StatsPeriod {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
}

// User interface
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  googleId?: string;
  githubId?: string;
  role: UserRole;
  phoneNumber?: string;
  themeColor?: string;
  emailNotifications?: boolean;
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
  profilePictureUrl?: string;
  bio?: string;
  experienceLevel?: ExperienceLevel;
  isActivelyLooking?: boolean;
  education?: {
    school: string;
    degree: string;
    year: number;
  }[];
  cvParseCount?: number;
  cvParseDate?: Date;
  cvReviewCount?: number;
  cvReviewDate?: Date;
  aiMatchCount?: number;
  aiMatchDate?: Date;
  createdAt: Date;
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
  foundedYear?: number;
  employeeCount?: number;
  slogan?: string;
  createdAt: Date;
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
  responsibilities?: string;
  requirements?: string;
  additionalInfo?: string;
  deadline?: Date;
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

// Notification types
export enum NotificationType {
  INVITATION_RECEIVED = "INVITATION_RECEIVED",
  INVITATION_ACCEPTED = "INVITATION_ACCEPTED",
  INVITATION_REJECTED = "INVITATION_REJECTED",
  APPLICATION_RECEIVED = "APPLICATION_RECEIVED",
  APPLICATION_STATUS_CHANGED = "APPLICATION_STATUS_CHANGED",
  NEW_JOB_POSTED = "NEW_JOB_POSTED",
  COMPANY_PENDING_VERIFICATION = "COMPANY_PENDING_VERIFICATION",
  NEW_USER_REGISTERED = "NEW_USER_REGISTERED",
}

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: Date;
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
  _cachedStudentProfile?: any;
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
