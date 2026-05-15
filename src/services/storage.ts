import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "../domain/tasks";

export const STORAGE_KEY = "wecom-todo-workbench.tasks.v1";

export function loadTasks(storage: Storage = localStorage): Task[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return normalizeTasks(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[], storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function exportTasks(tasks: Task[]): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
    },
    null,
    2,
  );
}

export function importTasks(raw: string): Task[] {
  try {
    const parsed = JSON.parse(raw);
    return normalizeTasks(parsed);
  } catch (error) {
    if (error instanceof Error && error.message === "备份文件格式不正确") {
      throw error;
    }

    throw new Error("备份文件格式不正确");
  }
}

function normalizeTasks(value: unknown): Task[] {
  const records = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { tasks?: unknown }).tasks)
      ? (value as { tasks: unknown[] }).tasks
      : null;

  if (!records || !records.every(isTaskRecord)) {
    throw new Error("备份文件格式不正确");
  }

  return records;
}

function isTaskRecord(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Task;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.source === "string" &&
    TASK_PRIORITIES.includes(task.priority) &&
    TASK_STATUSES.includes(task.status) &&
    typeof task.dueAt === "string" &&
    typeof task.notes === "string" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string" &&
    (typeof task.completedAt === "string" || task.completedAt === null) &&
    (typeof task.notificationSentAt === "string" || task.notificationSentAt === null)
  );
}
