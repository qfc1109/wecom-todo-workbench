import { describe, expect, it, vi } from "vitest";
import { createTask, updateTaskStatus } from "../domain/tasks";
import { collectDueTasks, notifyDueTasks } from "./notifications";

const now = new Date("2026-05-15T09:00:00+08:00");

describe("notifications", () => {
  it("collects due active tasks that have not already notified", () => {
    const due = createTask({ title: "该提醒", source: "企微", dueAt: "2026-05-15T08:59" }, now);
    const future = createTask({ title: "未到期", source: "企微", dueAt: "2026-05-15T09:30" }, now);
    const done = updateTaskStatus(
      createTask({ title: "已完成", source: "企微", dueAt: "2026-05-15T08:30" }, now),
      "已完成",
      now,
    );
    const notified = { ...due, id: "already", title: "已提醒", notificationSentAt: now.toISOString() };

    expect(collectDueTasks([future, done, notified, due], now).map((task) => task.title)).toEqual(["该提醒"]);
  });

  it("does nothing when notification permission is not granted", () => {
    const notificationFactory = vi.fn();
    const task = createTask({ title: "不应提醒", source: "企微", dueAt: "2026-05-15T08:59" }, now);

    const result = notifyDueTasks([task], {
      now,
      permission: "denied",
      createNotification: notificationFactory,
    });

    expect(notificationFactory).not.toHaveBeenCalled();
    expect(result).toEqual([task]);
  });

  it("fires browser notifications for due tasks and stamps them as notified", () => {
    const notificationFactory = vi.fn();
    const task = createTask({ title: "提醒我", source: "企微群", dueAt: "2026-05-15T08:59" }, now);

    const result = notifyDueTasks([task], {
      now,
      permission: "granted",
      createNotification: notificationFactory,
    });

    expect(notificationFactory).toHaveBeenCalledWith("企业微信待办到期", {
      body: "提醒我 · 来源：企微群",
      tag: task.id,
    });
    expect(result[0].notificationSentAt).toBe(now.toISOString());
  });
});
