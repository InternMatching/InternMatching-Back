import Notification from "./notification.model.js";
import { requireAuth } from "../../middleware/auth.js";
import { type Context } from "../../types/index.js";

function serializeNotif(n: any) {
  return {
    id: n._id.toString(),
    userId: n.userId.toString(),
    type: n.type,
    title: n.title,
    message: n.message,
    // data field is typed as String in GraphQL schema — serialize to JSON string
    data: JSON.stringify(n.data ?? {}),
    read: n.read,
    createdAt: n.createdAt instanceof Date
      ? n.createdAt.toISOString()
      : new Date(n.createdAt).toISOString(),
  };
}

export const notificationResolvers = {
  Query: {
    getNotifications: async (_: any, { limit = 30 }: { limit?: number }, context: Context) => {
      const user = requireAuth(context);
      console.log(`[getNotifications] userId=${user.userId} limit=${limit}`);
      const notifs = await Notification.find({ userId: user.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      console.log(`[getNotifications] found ${notifs.length} notifications`);
      return notifs.map(serializeNotif);
    },

    getUnreadNotificationCount: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      const count = await Notification.countDocuments({ userId: user.userId, read: false });
      console.log(`[getUnreadNotificationCount] userId=${user.userId} count=${count}`);
      return count;
    },
  },

  Mutation: {
    markNotificationRead: async (_: any, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context);
      await Notification.updateOne({ _id: id, userId: user.userId }, { read: true });
      return true;
    },

    markAllNotificationsRead: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      await Notification.updateMany({ userId: user.userId, read: false }, { read: true });
      return true;
    },

    deleteNotification: async (_: any, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context);
      await Notification.deleteOne({ _id: id, userId: user.userId });
      return true;
    },
  },
};
