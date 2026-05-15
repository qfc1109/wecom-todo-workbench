import { describe, expect, it } from "vitest";
import {
  createTask,
  groupTasksByDueDate,
  isTaskOverdue,
  sortTasksByUrgency,
  updateTaskStatus,
} from "./tasks";

const now = new Date("2026-05-15T09:00:00+08:00");

describe("task domain", () => {
  it("creates a task with required workbench defaults", () => {
    const task = createTask(
      {
        title: "跟进合同审批",
        source: "企业微信/法务群",
        dueAt: "2026-05-15T18:30",
      },
      now,
    );

    expect(task).toMatchObject({
      title: "跟进合同审批",
      source: "企业微信/法务群",
      priority: "中",
      status: "待处理",
      notes: "",
      dueAt: "2026-05-15T18:30",
    });
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toBe(now.toISOString());
    expect(task.updatedAt).toBe(now.toISOString());
    expect(task.completedAt).toBeNull();
  });

  it("marks completed tasks with a completion timestamp and can restore them", () => {
    const task = createTask(
      { title: "回企业微信", source: "张三", dueAt: "2026-05-15T10:00" },
      now,
    );
    const completed = updateTaskStatus(task, "已完成", new Date("2026-05-15T10:15:00+08:00"));
    const restored = updateTaskStatus(completed, "进行中", new Date("2026-05-15T10:20:00+08:00"));

    expect(completed.completedAt).toBe("2026-05-15T02:15:00.000Z");
    expect(restored.status).toBe("进行中");
    expect(restored.completedAt).toBeNull();
  });

  it("groups active tasks into overdue, today, and future buckets", () => {
    const overdue = createTask({ title: "昨天事项", source: "客户群", dueAt: "2026-05-14T18:00" }, now);
    const today = createTask({ title: "今天事项", source: "销售群", dueAt: "2026-05-15T16:00" }, now);
    const future = createTask({ title: "明天事项", source: "项目群", dueAt: "2026-05-16T09:00" }, now);
    const done = updateTaskStatus(
      createTask({ title: "已完成事项", source: "老板", dueAt: "2026-05-15T11:00" }, now),
      "已完成",
      now,
    );

    const grouped = groupTasksByDueDate([future, today, overdue, done], now);

    expect(grouped.overdue.map((task) => task.title)).toEqual(["昨天事项"]);
    expect(grouped.today.map((task) => task.title)).toEqual(["今天事项"]);
    expect(grouped.future.map((task) => task.title)).toEqual(["明天事项"]);
    expect(grouped.completed.map((task) => task.title)).toEqual(["已完成事项"]);
  });

  it("sorts urgent unfinished tasks before lower priority and completed tasks", () => {
    const high = createTask({ title: "高优先级", source: "老板", priority: "高", dueAt: "2026-05-15T20:00" }, now);
    const low = createTask({ title: "低优先级", source: "群聊", priority: "低", dueAt: "2026-05-15T11:00" }, now);
    const done = updateTaskStatus(
      createTask({ title: "已完成", source: "群聊", priority: "高", dueAt: "2026-05-15T08:00" }, now),
      "已完成",
      now,
    );

    expect(sortTasksByUrgency([done, low, high]).map((task) => task.title)).toEqual([
      "高优先级",
      "低优先级",
      "已完成",
    ]);
  });

  it("does not consider completed tasks overdue", () => {
    const active = createTask({ title: "逾期", source: "同事", dueAt: "2026-05-15T08:00" }, now);
    const completed = updateTaskStatus(active, "已完成", now);

    expect(isTaskOverdue(active, now)).toBe(true);
    expect(isTaskOverdue(completed, now)).toBe(false);
  });
});
