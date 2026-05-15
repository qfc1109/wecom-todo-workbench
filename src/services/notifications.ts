import { isTaskOverdue, parseDueAt, type Task } from "../domain/tasks";

export interface NotificationDeps {
  now: Date;
  permission: NotificationPermission;
  createNotification: (title: string, options?: NotificationOptions) => unknown;
}

export function collectDueTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter(
    (task) =>
      task.status !== "已完成" &&
      task.notificationSentAt === null &&
      parseDueAt(task.dueAt).getTime() <= now.getTime(),
  );
}

export function notifyDueTasks(tasks: Task[], deps: NotificationDeps): Task[] {
  if (deps.permission !== "granted") {
    return tasks;
  }

  const dueTasks = collectDueTasks(tasks, deps.now);
  if (dueTasks.length === 0) {
    return tasks;
  }

  const notifiedIds = new Set<string>();

  dueTasks.forEach((task) => {
    deps.createNotification("企业微信待办到期", {
      body: `${task.title} · 来源：${task.source || "未填写"}`,
      tag: task.id,
    });
    notifiedIds.add(task.id);
  });

  return tasks.map((task) =>
    notifiedIds.has(task.id) ? { ...task, notificationSentAt: deps.now.toISOString() } : task,
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }

  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }

  return Notification.requestPermission();
}

export function getAttentionCount(tasks: Task[], now = new Date()): number {
  return tasks.filter((task) => isTaskOverdue(task, now)).length;
}
