import { GraphQLError } from "graphql";
import { User, StudentProfile, CompanyProfile, Job, Application } from "../../models/index.js";
import { Context, UserRole, StatsPeriod } from "../../types/index.js";
import { requireRole } from "../../middleware/auth.js";

export const adminResolvers = {
  Query: {
    getAllUsers: async (_: any, __: any, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);
      const users = await User.find().sort({ createdAt: -1 });
      return users.map(user => ({
        ...user.toObject(),
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        themeColor: user.themeColor,
        emailNotifications: user.emailNotifications,
        createdAt: user.createdAt.toISOString()
      }));
    },

    adminStats: async (_: any, { period = StatsPeriod.DAILY }: { period?: StatsPeriod }, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);
      const [
        totalUsers,
        totalStudents,
        totalCompanies,
        activeJobs,
        totalApplications,
        pendingVerifications,
        newUsersToday
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: UserRole.STUDENT }),
        User.countDocuments({ role: UserRole.COMPANY }),
        Job.countDocuments({ status: "open" }),
        Application.countDocuments(),
        CompanyProfile.countDocuments({ isVerified: false }),
        User.countDocuments({ 
          createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } 
        })
      ]);

      // Get growth data based on period
      const growthDataEntries = [];
      const isWeekly = period === StatsPeriod.WEEKLY;
      
      if (isWeekly) {
        // Last 7 weeks
        for (let i = 6; i >= 0; i--) {
          const start = new Date();
          start.setDate(start.getDate() - (i * 7));
          start.setHours(0, 0, 0, 0);
          
          const end = new Date(start);
          end.setDate(end.getDate() + 7);

          const [userCount, appCount] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
            Application.countDocuments({ createdAt: { $gte: start, $lt: end } })
          ]);

          growthDataEntries.push({
            name: i === 0 ? "Энэ долоо" : `${i} долоо`,
            users: userCount,
            apps: appCount
          });
        }
      } else {
        // Last 7 days
        const dayNames = ['Ням', 'Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям'];
        for (let i = 6; i >= 0; i--) {
          const start = new Date();
          start.setDate(start.getDate() - i);
          start.setHours(0, 0, 0, 0);
          
          const end = new Date(start);
          end.setDate(end.getDate() + 1);

          const [userCount, appCount] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
            Application.countDocuments({ createdAt: { $gte: start, $lt: end } })
          ]);

          growthDataEntries.push({
            name: dayNames[start.getDay()],
            users: userCount,
            apps: appCount
          });
        }
      }

      // Get recent activities from multiple collections
      const [recentUsers, recentStudents, recentCompanies, recentJobs, recentApps] = await Promise.all([
        User.find({ role: { $ne: UserRole.ADMIN } }).sort({ createdAt: -1 }).limit(5),
        StudentProfile.find().sort({ createdAt: -1 }).limit(5).populate("userId"),
        CompanyProfile.find().sort({ createdAt: -1 }).limit(5).populate("userId"),
        Job.find().sort({ postedAt: -1 }).limit(5).populate("companyProfileId"),
        Application.find().sort({ appliedAt: -1 }).limit(5)
          .populate({ path: "studentProfileId", select: "firstName lastName" })
          .populate({ path: "jobId", select: "title" })
      ]);

      const activities = [
        ...recentUsers.map(u => ({
          id: u._id.toString() + "_signup",
          user: u.email || "Хэрэглэгч",
          action: u.role === UserRole.STUDENT ? "Оюутнаар бүртгүүллээ" : "Компаниар бүртгүүллээ",
          timestamp: u.createdAt.toISOString(),
          type: u.role === UserRole.STUDENT ? "STUDENT_SIGNUP" : "COMPANY_SIGNUP"
        })),
        ...recentStudents.map(s => ({
          id: s._id.toString() + "_profile",
          user: (s.userId as any)?.email || s.firstName || "Хэрэглэгч",
          action: "Оюутны профайл үүсгэлээ",
          timestamp: s.createdAt.toISOString(),
          type: "STUDENT_PROFILE_CREATED"
        })),
        ...recentCompanies.map(c => ({
          id: c._id.toString() + "_profile",
          user: c.companyName || (c.userId as any)?.email || "Компани",
          action: "Компани профайл үүсгэлээ",
          timestamp: c.createdAt.toISOString(),
          type: "COMPANY_PROFILE_CREATED"
        })),
        ...recentJobs.map(j => ({
          id: j._id.toString(),
          user: (j.companyProfileId as any)?.companyName || "Компани",
          action: (j.title || "Ажил") + " ажлын байр зарлагдлаа",
          timestamp: j.postedAt.toISOString(),
          type: "JOB_POSTED"
        })),
        ...recentApps.map(a => ({
          id: a._id.toString(),
          user: (a.studentProfileId as any)?.firstName ? `${(a.studentProfileId as any).firstName} ${(a.studentProfileId as any).lastName || ""}`.trim() : "Оюутан",
          action: `${(a.jobId as any)?.title || "Ажил"}-д өргөдөл илгээлээ`,
          timestamp: a.appliedAt.toISOString(),
          type: "APPLICATION_SUBMITTED"
        }))
      ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((activity, index, self) => 
        index === self.findIndex((t) => t.id === activity.id)
      )
      .slice(0, 10);

      return {
        totalUsers,
        totalStudents,
        totalCompanies,
        activeJobs,
        totalApplications,
        pendingVerifications,
        newUsersToday,
        growthData: growthDataEntries,
        recentActivities: activities
      };
    }
  },

  Mutation: {
    deleteUser: async (_: any, { userId }: { userId: string }, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);

      const user = await User.findById(userId);
      if (!user) {
        throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      }

      // 1. Delete profiles
      if (user.role === UserRole.STUDENT) {
        const profile = await StudentProfile.findOne({ userId });
        if (profile) {
          await Application.deleteMany({ studentProfileId: profile._id });
          await StudentProfile.deleteOne({ _id: profile._id });
        }
      } else if (user.role === UserRole.COMPANY) {
        const profile = await CompanyProfile.findOne({ userId });
        if (profile) {
          const jobs = await Job.find({ companyProfileId: profile._id });
          const jobIds = jobs.map(j => j._id);
          await Application.deleteMany({ jobId: { $in: jobIds } });
          await Job.deleteMany({ companyProfileId: profile._id });
          await CompanyProfile.deleteOne({ _id: profile._id });
        }
      }

      // 2. Delete user
      await User.deleteOne({ _id: userId });
      return true;
    },

    updateSettings: async (_: any, { input }: { input: any }, context: Context) => {
      const user = requireRole(context, [UserRole.ADMIN, UserRole.COMPANY, UserRole.STUDENT]);
      
      const updatedUser = await User.findByIdAndUpdate(
        user.userId,
        { $set: input },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      }

      return {
        ...updatedUser.toObject(),
        id: updatedUser._id.toString(),
        createdAt: updatedUser.createdAt.toISOString()
      };
    }
  }
};
