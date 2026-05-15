import { beforeEach, describe, expect, it } from "vitest";
import { createTask } from "../domain/tasks";
import { exportTasks, importTasks, loadTasks, saveTasks, STORAGE_KEY } from "./storage";

describe("task storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads tasks from localStorage", () => {
    const task = createTask(
      { title: "保存企业微信待办", source: "测试群", dueAt: "2026-05-15T12:00" },
      new Date("2026-05-15T09:00:00+08:00"),
    );

    saveTasks([task]);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toHaveLength(1);
    expect(loadTasks()).toEqual([task]);
  });

  it("returns an empty list when stored data is missing or invalid", () => {
    expect(loadTasks()).toEqual([]);

    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(loadTasks()).toEqual([]);
  });

  it("exports and imports valid task backup JSON", () => {
    const task = createTask(
      { title: "导出备份", source: "文件传输助手", dueAt: "2026-05-16T10:00" },
      new Date("2026-05-15T09:00:00+08:00"),
    );

    const exported = exportTasks([task]);
    const imported = importTasks(exported);

    expect(imported).toEqual([task]);
  });

  it("exports tasks inside a versioned backup envelope", () => {
    const task = createTask(
      { title: "校验备份结构", source: "测试群", dueAt: "2026-05-16T10:00" },
      new Date("2026-05-15T09:00:00+08:00"),
    );

    expect(JSON.parse(exportTasks([task]))).toMatchObject({
      version: 1,
      exportedAt: expect.any(String),
      tasks: [task],
    });
  });

  it("rejects backup JSON that does not contain task records", () => {
    expect(() => importTasks('{"items":[1]}')).toThrow("备份文件格式不正确");
  });

  it("rejects backup JSON with invalid task fields", () => {
    const task = createTask(
      { title: "非法字段", source: "测试群", dueAt: "2026-05-16T10:00" },
      new Date("2026-05-15T09:00:00+08:00"),
    );

    expect(() => importTasks(JSON.stringify({ version: 1, tasks: [{ ...task, status: "已取消" }] }))).toThrow(
      "备份文件格式不正确",
    );
  });

  it("rejects invalid JSON backup content", () => {
    expect(() => importTasks("{not json")).toThrow("备份文件格式不正确");
  });
});
