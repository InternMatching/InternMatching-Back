import Notification from "../modules/notification/notification.model.js";
import { NotificationType } from "../types/index.js";
import { pushSSE } from "./sseManager.js";

interface PushParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, string>;
}

export async function pushNotification(params: PushParams): Promise<void> {
  try {
    console.log(`[pushNotification] type=${params.type} userId=${params.userId} title="${params.title}"`);

    const notif = await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ?? {},
      read: false,
    });

    console.log(`[pushNotification] saved id=${notif._id.toString()}`);

    const payload = {
      id: notif._id.toString(),
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: params.data ?? {},
      read: false,
      createdAt: (notif.createdAt instanceof Date ? notif.createdAt : new Date()).toISOString(),
    };

    pushSSE(params.userId, "notification", payload);
  } catch (err) {
    console.error("[pushNotification] FAILED:", err);
  }
}
